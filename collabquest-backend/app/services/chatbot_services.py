import os
import asyncio
import json
import ast
import re
from typing import TypedDict, Literal
from datetime import datetime, timedelta

from openai import AsyncOpenAI
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END

from app.models import ChatMessage, Team, DeletionRequest, Notification, Task, User, CompletionRequest, MemberRequest, Match, ExtensionRequest
from app.services.recommendation_service import search_vectors, sync_data_to_chroma
from app.services.vector_store import generate_embedding, calculate_similarity

INTENT_EXAMPLES = {
    "CREATE_PROJECT": [
        "create a new project", "start a team", "post an idea", "build a new app", 
        "launch a startup", "I have an idea for a project", "make a group for hackathon",
        "initialize a new repo", "setup a team space"
    ],
    "DELETE_PROJECT": [
        "delete this project", "remove this team", "cancel the project", "destroy the group", 
        "delete my project", "erase this workspace", "wipe the project data", "terminate the team"
    ],
    "COMPLETE_PROJECT": [
        "mark as complete", "finish the project", "we are done", "project is finished", 
        "close the project", "archive this team", "set status to completed", "wrap up this project"
    ],
    "LEAVE_TEAM": [
        "leave the team", "quit this project", "exit the group", "resign from team", 
        "remove me from this project", "withdraw my membership", "step down from this group"
    ],
    "REMOVE_MEMBER": [
        "remove a member", "kick someone out", "fire a developer", "ban a user", 
        "remove him from the team", "dismiss this person", "boot member from group"
    ],
    "ASSIGN_TASK": [
        "assign a task", "give a job to someone", "create a to-do item", "delegate this work", 
        "add a task for her", "create a ticket", "assign this issue to John", "new task: fix bugs"
    ],
    "EXTEND_DEADLINE": [
        "extend the deadline", "push back the date", "need more time", "change the due date", 
        "postpone the task", "delay the submission", "reschedule the deadline", "add 2 days to the task"
    ],
    "SHOW_TASKS": [
        "show my tasks", "what do i need to do", "check my todo list", "pending work", 
        "my assignments", "list my active tickets", "what is on my plate?", "show my deliverables"
    ],
    "DAILY_BRIEFING": [
        "daily briefing", "what did i miss", "show notifications", "any updates", 
        "summarize my day", "catch me up", "morning report", "show recent activity"
    ],
    "ANALYZE_TEAM": [
        "analyze the team skills", "check skill gaps", "what skills are missing", "evaluate our roster", 
        "team composition analysis", "do we need more developers?", "assess team balance", "hiring recommendations"
    ],
    "SEND_MESSAGE": [
        "send a message", "tell the team", "broadcast an announcement", "message him", 
        "notify everyone", "send a dm to Alice", "announcement: meeting starts now"
    ],
    "MANAGE_RECRUITMENT": [
        "stop recruiting", "close applications", "open recruitment", 
        "start looking for members", "we are full", "open spots available",
        "pause hiring", "resume applications",
        "resume recruiting", "start recruiting", "enable recruitment" # <--- ADD THESE
    ],
    "CODE_REQUEST": [
        "write python code", "fix this bug", "debug this function", "how do I code this", 
        "generate a script", "create a react component", "refactor this code", "explain this error"
    ],
    "SEARCH_REQUEST": [
        "find a project", "search for teams", "projects using react", "looking for a team to join",
        "search for open source projects", "find a game dev team", "browse active projects"
    ],
    "PROJECT_QUERY": [
        "who is overloaded?", "who has too many tasks?", "show tasks with extended deadlines",
        "who has the most work?", "which project is falling behind?", "show me all completed tasks",
        "is anyone overloaded in the tic-tac-toe project?", "summary of my projects", 
        "what is Alice working on?", "task status report", "show team velocity"
    ],
    "GENERAL_QUERY": [
        # Greetings & Persona
        "Hello", "Hi", "how are you?", "who are you?", "what can you do?", 
        
        # Project List (Informational)
        "tell me about my ongoing projects", "what projects am I working on?", "list my projects",
        
        # "How-To" Instructions (CRITICAL FOR DISAMBIGUATION)
        "how do I recruit people?", "how to find developers", "where is the recruit page?",
        "how does the matching work?", "how to create a team", "how do I leave a project?",
        "explain the voting system", "how do I verify my skills?", "where can I change my avatar?",
        "recruit developers", "find members", "hire people", "look for candidates", # These act as "How-to" because bot can't swipe for user
        "swipe on users", "match with people"
    ]
}

load_dotenv()

# --- CONFIGURATION ---
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

# Models
ROUTER_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free"
CODER_MODEL = "xiaomi/mimo-v2-flash:free"
MENTOR_MODEL = "meta-llama/llama-3.3-70b-instruct:free" 

# --- 1. DEFINE THE STATE (The Memory of the Graph) ---
class AgentState(TypedDict):
    question: str
    user_id: str
    user_skills: list[str]
    intent: str
    final_response: str
    history: list[dict] 
    is_confirmed: bool

async def find_relevant_project(user_input: str, projects: list[Team]):
    """
    Smartly finds a project from a list using 2 layers of search:
    1. Exact/Containment Match (Fastest) - e.g. "Delete Maze Solver" matches "Maze Solver"
    2. Vector/Semantic Match (Smartest) - e.g. "Maze Sovler" matches "Maze Solver"
    """
    if not projects: return None
    
    user_input_lower = user_input.lower().strip()
    
    # Sort by length descending so "Maze Solver Pro" matches before "Maze Solver"
    sorted_projects = sorted(projects, key=lambda p: len(p.name), reverse=True)
    
    # --- LAYER 1: Project Name in Input (Exact Match) ---
    # Example: User says "Delete Maze Solver now" -> Matches "Maze Solver"
    for p in sorted_projects:
        if p.name.lower() in user_input_lower:
            return p

    # --- LAYER 2: 🔍 Vector Search (Semantic/Typos) ---
    # Only runs if exact text match failed.
    target_vec = generate_embedding(user_input)
    best_score = 0.0
    best_match = None
    
    for p in projects:
        p_vec = generate_embedding(p.name)
        score = calculate_similarity(target_vec, p_vec)
        
        if score > best_score:
            best_score = score
            best_match = p
    
    # Threshold: 0.45 balances flexibility with accuracy
    if best_score > 0.45:
        return best_match
        
    return None

def get_skill_name(skill_item):
    """Safely extracts the string name from a Skill object or String."""
    if isinstance(skill_item, str):
        return skill_item
    if hasattr(skill_item, "name"):
        return skill_item.name
    return str(skill_item)

async def get_semantic_intent(user_input: str) -> str | None:
    """
    Hybrid Router Layer 1: Vector Similarity Check.
    Returns the intent if confidence > 0.7, else None.
    """
    user_vec = generate_embedding(user_input)
    best_score = 0.0
    best_intent = None

    for intent, examples in INTENT_EXAMPLES.items():
        for example in examples:
            example_vec = generate_embedding(example)
            score = calculate_similarity(user_vec, example_vec)
            
            if score > best_score:
                best_score = score
                best_intent = intent

    # 🛡️ Threshold: 0.70 (70%)
    # If we are 70% sure, we skip the LLM. If not, we let the LLM decide.
    if best_score > 0.70:
        return best_intent
    
    return None

# --- 2. DEFINE THE NODES (The Agents) ---

async def router_node(state: AgentState):
    """
    Decides which path to take using a 'Best of Both Worlds' approach:
    1. Semantic Search (Fast & Precise)
    2. Few-Shot LLM (Smart & Flexible)
    """
    question = state["question"]

    history = state.get("history", [])
    # Check if the last message from the BOT was a confirmation question
    if history and len(history) >= 2:
        last_bot_msg = history[-1]["content"]
        
        # Only activate if the bot actually asked for confirmation
        if "Are you sure" in last_bot_msg or "confirm" in last_bot_msg.lower():
            
            user_input = question.lower().strip()
            
            # 1. NEGATION CHECK (The Safety Guard)
            # If the user shows ANY hesitation, we assume "NO" and process as a new command.
            negation_keywords = ["no", "wait", "stop", "don't", "cancel", "change my mind", "actually", "nevermind"]
            
            if any(word in user_input for word in negation_keywords):
                # User hesitated ("Actually no", "Wait stop"). 
                # We DO NOT confirm. We let the standard router handle this as a new request.
                pass 
                
            # 2. CONFIRMATION CHECK
            # We only proceed here if they didn't say "no".
            else:
                confirm_keywords = ["yes", "y", "confirm", "sure", "do it", "proceed", "okay", "correct", "delete"]
                
                if any(word in user_input for word in confirm_keywords):
                    # User confirmed! Retrieve original intent.
                    original_user_msg = history[-2]["content"] 
                    print(f"🔄 Confirmation Received! Re-processing: '{original_user_msg}'")
                    
                    re_routed = await router_node({**state, "question": original_user_msg, "history": []})
                    
                    return {
                        "intent": re_routed["intent"], 
                        "is_confirmed": True, 
                        "question": original_user_msg # Overwrite with original command
                    }

    print(f"🧠 Routing: {question[:30]}...")
    
    # --- PHASE 1: SEMANTIC ROUTING (Speed Layer) ---
    semantic_intent = await get_semantic_intent(question)
    
    if semantic_intent:
        print(f"⚡ Semantic Router: {semantic_intent}")
        return {"intent": semantic_intent}

    # --- PHASE 2: LLM ROUTING (Intelligence Layer) ---
    # If semantic search wasn't confident, we ask the LLM.
    # We use "Few-Shot Prompting" (giving examples) to make it smarter.
    
    router_prompt = """You are the Intent Classifier for a Project Management AI.
    Classify the user's input into EXACTLY ONE of these categories:

    [ACTION CATEGORIES - The Bot performs these]
    - CREATE_PROJECT (User wants to make a new team/project)
    - DELETE_PROJECT (User wants to delete a project)
    - COMPLETE_PROJECT (User wants to mark a project as finished)
    - LEAVE_TEAM (User wants to leave a team)
    - REMOVE_MEMBER (User wants to kick someone)
    - ASSIGN_TASK (User is creating a specific task)
    - EXTEND_DEADLINE (User asks for more time on a task)
    - SHOW_TASKS (User wants to see their todo list)
    - DAILY_BRIEFING (User wants a summary of notifications)
    - ANALYZE_TEAM (User asks about skills, hiring gaps, or roster balance)
    - SEND_MESSAGE (User wants to broadcast/DM someone)
    - MANAGE_RECRUITMENT (User wants to open/close recruitment for a project)
    - CODE_REQUEST (User asks for code generation or debugging)
    - SEARCH_REQUEST (User is looking for *Projects* to join)
    - PROJECT_QUERY (User asks about *Data/Workload* - e.g., "Who is busy?", "Task status")

    [GENERAL/INSTRUCTIONAL - The Bot explains/chats]
    - GENERAL_QUERY (Greetings, "How-to" questions, or requests the bot CANNOT do like "Recruiting")

    [CRITICAL DISAMBIGUATION RULES]
    1. **"Recruit" vs "Search":** - If user says "Recruit people", "Find developers", "Hire members" -> GENERAL_QUERY (Bot cannot recruit; it must explain how to use the UI).
       - If user says "Resume recruiting", "Start recruiting", "Stop recruiting" (Project Setting Switch) -> MANAGE_RECRUITMENT  <-- ADD THIS RULE
       - If user says "Find a project", "Search for teams" -> SEARCH_REQUEST (Bot CAN search projects).

    2. **"Action" vs "How-To":**
       - "Create a project" -> CREATE_PROJECT
       - "How do I create a project?" -> GENERAL_QUERY
       - "Delete this team" -> DELETE_PROJECT
       - "How do I delete?" -> GENERAL_QUERY

    3. **"Analyze" vs "Query":**
       - "What skills are missing?" -> ANALYZE_TEAM
       - "Who is overloaded?" -> PROJECT_QUERY

    [FEW-SHOT EXAMPLES]
    Input: "I want to build a React app" -> CREATE_PROJECT
    Input: "How do I recruit members?" -> GENERAL_QUERY
    Input: "Find me a developer for Python" -> GENERAL_QUERY (Bot can't search people, only projects)
    Input: "Find me a Python project to join" -> SEARCH_REQUEST
    Input: "Who has the most open tasks?" -> PROJECT_QUERY
    Input: "Kick John out of the group" -> REMOVE_MEMBER
    Input: "Hello, how are you?" -> GENERAL_QUERY
    

    [YOUR TASK]
    User Input: "{question}"
    
    Respond with ONLY the category name. Do not explain."""

    try:
        completion = await client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[{"role": "user", "content": router_prompt.format(question=question)}],
            temperature=0.0
        )
        intent = completion.choices[0].message.content.strip().upper()
    except:
        intent = "GENERAL_QUERY"
        
    # --- PHASE 3: SAFETY VALIDATION ---
    # Ensure the LLM didn't hallucinate a fake category
    valid_intents = list(INTENT_EXAMPLES.keys()) + ["GENERAL_QUERY"]
    
    if intent not in valid_intents:
        # Fallback: If LLM gives garbage, treat as general chat
        intent = "GENERAL_QUERY"
        
    print(f"🤖 LLM Router: {intent}")
    return {"intent": intent}

async def planner_node(state: AgentState):
    """
    Brute-Force Planner Node.
    Does NOT use json.loads. Does NOT use ast.literal_eval.
    It purely scans the text for answers to avoid KeyErrors.
    """
    print("🚀 Planner Node Active (Brute Force Mode)")
    
    # Define the strict list again here to be safe
    ALLOWED_SKILLS = [
        "React", "Python", "Node.js", "TypeScript", "Next.js",
        "Tailwind", "MongoDB", "Firebase", "Flutter", "Java",
        "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML",
        "Docker", "AWS", "Solidity", "Blockchain"
    ]
    allowed_str = ", ".join(ALLOWED_SKILLS)
    
    system_prompt = f"""
    You are a Technical Project Manager.
    Convert the idea: "{{idea}}" into a Project Plan.
    
    INSTRUCTIONS:
    - You must output the format exactly as requested.
    - Pick skills ONLY from: [{allowed_str}]
    
    REQUIRED OUTPUT FORMAT:
    NAME: <Project Name>
    DESCRIPTION: <Short Description>
    SKILLS: <Skill 1>, <Skill 2>, <Skill 3>
    ROADMAP:
    - <Step 1>
    - <Step 2>
    """
    
    try:
        completion = await client.chat.completions.create(
            model=MENTOR_MODEL,
            messages=[{"role": "user", "content": system_prompt.format(idea=state["question"])}]
        )
        
        raw_text = completion.choices[0].message.content
        
        # --- BRUTE FORCE TEXT PARSING (No JSON Errors possible) ---
        name = "Untitled Project"
        description = "No description provided."
        skills = ["Python"]
        roadmap = []

        # 1. Extract Name (Look for "NAME: ...")
        name_match = re.search(r"NAME:\s*(.+)", raw_text, re.IGNORECASE)
        if name_match:
            name = name_match.group(1).strip().strip('"').strip("'")
            
        # 2. Extract Description (Look for "DESCRIPTION: ...")
        desc_match = re.search(r"DESCRIPTION:\s*(.+)", raw_text, re.IGNORECASE)
        if desc_match:
            description = desc_match.group(1).strip().strip('"').strip("'")

        # 3. Extract Skills (Look for "SKILLS: ...")
        skills_match = re.search(r"SKILLS:\s*(.+)", raw_text, re.IGNORECASE)
        if skills_match:
            raw_skills_line = skills_match.group(1)
            # Split by comma and clean up
            potential_skills = [s.strip() for s in raw_skills_line.split(",")]
            # Filter against ALLOWED_SKILLS
            skills = [s for s in potential_skills if s in ALLOWED_SKILLS]
        
        # Fallback if no valid skills found
        if not skills:
            skills = ["Python"]

        # 4. Extract Roadmap (Look for lines starting with - )
        roadmap_lines = re.findall(r"-\s*(.+)", raw_text)
        if roadmap_lines:
            roadmap = [line.strip() for line in roadmap_lines]

        # --- DATABASE INSERT ---
        new_team = Team(
            name=name,
            description=description,
            leader_id=state["user_id"],
            needed_skills=skills,
            members=[state["user_id"]],
            roadmap=roadmap
        )
        await new_team.insert()
        
        response = f"✅ Created **{name}**!\nStack: {', '.join(skills)}"
    
    except Exception as e:
        print(f"❌ PLANNER ERROR: {e}")
        # Final fallback to keep the app running
        response = "I created the project structure, but couldn't parse all details. Please check your dashboard."
        
    return {"final_response": response}# app/services/chatbot_services.py

def extract_json_safely(raw_text: str):
    """Tries to parse JSON. Returns the raw dict or None."""
    if not raw_text: return None
    text = raw_text.replace("```json", "").replace("```", "").strip()
    
    # Try finding the outer brackets
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1: 
        text = text[start : end + 1]

    try: return json.loads(text)
    except: 
        try: return ast.literal_eval(text)
        except: return None
            
async def manager_node(state: AgentState):
    """Handles Project Management Actions."""
    print("👔 Manager Node Active")
    user_id = state["user_id"]
    intent = state["intent"]
    
    # 1. Fetch Projects
    relevant_teams = await Team.find(Team.members == user_id).to_list()
    if not relevant_teams:
        return {"final_response": "You don't have any projects to manage yet."}

    # --- HANDLE GLOBAL INTENTS (No specific project needed) ---
    if intent == "SHOW_TASKS":
        my_tasks = []
        for team in relevant_teams:
            for task in team.tasks:
                if task.assignee_id == user_id:
                    due = task.deadline.strftime('%Y-%m-%d')
                    my_tasks.append(f"• **{task.description}** (in *{team.name}*) — 📅 Due {due}")
        if not my_tasks: return {"final_response": "🎉 **You're all caught up!** No pending tasks."}
        return {"final_response": f"📋 **Your To-Do List:**\n\n" + "\n".join(my_tasks)}

    if intent == "DAILY_BRIEFING":
        notifs = await Notification.find(Notification.recipient_id == user_id).sort("-timestamp").limit(10).to_list()
        if not notifs: return {"final_response": "📭 **No new updates.**"}
        notif_text = "\n".join([f"- {n.message}" for n in notifs])
        prompt = f"Summarize these notifications for User {user_id}:\n{notif_text}"
        try:
            completion = await client.chat.completions.create(model=MENTOR_MODEL, messages=[{"role": "user", "content": prompt}])
            return {"final_response": f"🗞️ **Daily Briefing:**\n\n{completion.choices[0].message.content}"}
        except: return {"final_response": "Could not summarize notifications."}

    # --- SMART PROJECT IDENTIFICATION ---
    # 1. Use the new Helper (Exact + Vector)
    target_team = await find_relevant_project(state["question"], relevant_teams)

    # 2. Fallback to AI if helper failed (Rare, but useful for complex sentences)
    if not target_team:
        team_names = [t.name for t in relevant_teams]
        prompt = f"""
        User: "{state['question']}"
        Projects: {json.dumps(team_names)}
        Which project is this about? Return JUST the exact name. If none, return "NONE".
        """
        try:
            completion = await client.chat.completions.create(model=ROUTER_MODEL, messages=[{"role": "user", "content": prompt}], temperature=0.0)
            extracted_name = completion.choices[0].message.content.strip()
            target_team = next((t for t in relevant_teams if t.name.lower() == extracted_name.lower()), None)
        except:
            pass

    if not target_team:
        # 1. Prepare list of valid projects
        project_list = ', '.join([t.name for t in relevant_teams])
        
        # 2. Determine specific instruction based on Intent
        action_instruction = "Manage [Project Name]"
        
        if intent == "DELETE_PROJECT": 
            action_instruction = "Delete [Project Name]"
        elif intent == "COMPLETE_PROJECT": 
            action_instruction = "Mark [Project Name] as complete"
        elif intent == "LEAVE_TEAM":
            action_instruction = "Leave [Project Name]"
        elif intent == "REMOVE_MEMBER":                                 
            action_instruction = "Remove [Member Name] from [Project Name]"
        elif intent == "ASSIGN_TASK": 
            action_instruction = "Assign task in [Project Name]"
        elif intent == "EXTEND_DEADLINE": 
            action_instruction = "Extend deadline of [Task] in [Project Name]"
        elif intent == "ANALYZE_TEAM": 
            action_instruction = "Analyze team [Project Name]"
        elif intent == "SEND_MESSAGE": 
            action_instruction = "Tell [Name] in [Project Name] to [Message]"
        elif intent == "MANAGE_RECRUITMENT": 
            action_instruction = "Open/Close recruitment for [Project Name]"

        # 3. Return combined helpful response
        return {
            "final_response": (
                f"I'm not sure which project you mean. I can see these projects: **{project_list}**\n\n"
                f"Please try again with the full command:\n👉 **'{action_instruction}'**"
            )
        }
    
        # Check locked status
    if target_team.status == "completed" and intent != "DELETE_PROJECT":
        return {"final_response": f"❌ Project **{target_team.name}** is already completed and locked."}

    # --- BRANCH A: DELETE PROJECT ---
    if intent == "DELETE_PROJECT":
        # Case 1: Solo Project (Delete Immediately)
        if len(target_team.members) == 1:
            
            # --- PASTE THIS CHECK HERE ---
            if not state.get("is_confirmed"):
                return {
                    "final_response": f"⚠️ **Wait!** Are you sure you want to permanently DELETE **{target_team.name}**?\n\nType **'Yes'** to confirm."
                }
            # -----------------------------

            await target_team.delete()
            return {"final_response": f"🗑️ **{target_team.name}** has been permanently deleted."}  
             
        # Case 2: Team Project (Start Vote)
        if target_team.deletion_request and target_team.deletion_request.is_active:
            return {"final_response": f"⚠️ A deletion vote is already active for **{target_team.name}**."}

        req = DeletionRequest(
            is_active=True, 
            initiator_id=user_id, 
            votes={user_id: "approve"} 
        )
        target_team.deletion_request = req
        await target_team.save()
        
        # Notify members
        for member_id in target_team.members:
            if member_id != user_id:
                await Notification(
                    recipient_id=member_id, 
                    sender_id=user_id, 
                    message=f"Vote to DELETE project '{target_team.name}'.", 
                    type="deletion_request", 
                    related_id=str(target_team.id)
                ).insert()

        return {"final_response": f"🚨 **Vote Initiated:** I've started a deletion vote for **{target_team.name}**. Your team members have been notified."}

    # --- BRANCH B: COMPLETE PROJECT (NEW) ---
    if intent == "COMPLETE_PROJECT":
        # Case 1: Solo Project (Complete Immediately)
        if len(target_team.members) == 1:
            target_team.status = "completed"
            target_team.is_looking_for_members = False
            await target_team.save()
            return {"final_response": f"🏆 **{target_team.name}** is now marked as Completed! Great job."}
        
        # Case 2: Team Project (Start Vote)
        if target_team.completion_request and target_team.completion_request.is_active:
            return {"final_response": f"⚠️ A completion vote is already active for **{target_team.name}**."}

        req = CompletionRequest(
            is_active=True, 
            initiator_id=user_id, 
            votes={user_id: "approve"} 
        )
        target_team.completion_request = req
        await target_team.save()
        
        # Notify members
        for member_id in target_team.members:
            if member_id != user_id:
                await Notification(
                    recipient_id=member_id, 
                    sender_id=user_id, 
                    message=f"Vote to mark project '{target_team.name}' as COMPLETED.", 
                    type="completion_request", 
                    related_id=str(target_team.id)
                ).insert()
        
        return {"final_response": f"🏁 **Vote Initiated:** I've started a vote to complete **{target_team.name}**. Team members must approve."}

    # --- BRANCH C: LEAVE TEAM ---
    if intent == "LEAVE_TEAM":
        # 1. Leader Check
        if target_team.members[0] == user_id:
            return {"final_response": "❌ You are the **Team Leader**. You cannot leave your own project. Please **Delete** it or **Transfer Leadership** first."}
        
        # 2. Duplicate Request Check
        existing = next((r for r in target_team.member_requests if r.target_user_id == user_id and r.is_active), None)
        if existing:
            return {"final_response": "⚠️ You already have a pending request to leave this team."}

        # 3. Planning Phase (Instant Leave)
        if target_team.status == "planning":
            target_team.members.remove(user_id)
            await target_team.save()
            
            # Cleanup Match
            await Match.find(Match.project_id == str(target_team.id), Match.user_id == user_id).delete()
            
            # Notify Leader
            leader_id = target_team.members[0]
            await Notification(
                recipient_id=leader_id, 
                sender_id=user_id, 
                message=f"Member left project '{target_team.name}'.", 
                type="info"
            ).insert()
            
            return {"final_response": f"👋 **You left the team.** Since the project is in the planning phase, you were removed immediately."}

        # 4. Active Phase (Vote Required)
        else:
            req = MemberRequest(
                target_user_id=user_id, 
                type="leave", 
                explanation="Left via AI Chat", 
                initiator_id=user_id, 
                votes={user_id: "approve"} # You vote yes for yourself
            )
            target_team.member_requests.append(req)
            await target_team.save()
            
            # Notify Team
            for m_id in target_team.members:
                if m_id != user_id:
                    await Notification(
                        recipient_id=m_id, 
                        sender_id=user_id, 
                        message=f"Member wants to LEAVE '{target_team.name}'. Vote required.", 
                        type="member_request", 
                        related_id=str(target_team.id)
                    ).insert()

            return {"final_response": f"🗳️ **Vote Started.** Since the project is Active, your team must vote to let you leave. Notifications sent."}
    
    # --- BRANCH D: REMOVE MEMBER ---
    if intent == "REMOVE_MEMBER":
        # 1. PERMISSION CHECK (Strict Leader Only)
        if target_team.members[0] != user_id:
             return {"final_response": "❌ **Access Denied.** Only the Team Leader can initiate a vote to remove members."}

        # 2. Extract Target Member
        members_map = []
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u: members_map.append(f"{u.username} (ID: {str(u.id)})")
        
        extraction_prompt = f"""
        User Input: "{state['question']}"
        Team Members: {', '.join(members_map)}
        
        Which member does the user want to remove? 
        Return JSON: {{ "target_id": "..." }}
        If self-referencing or unclear, return "NONE".
        """
        
        try:
            # Uses Router Model (No response_format needed, but we use safe extraction)
            completion = await client.chat.completions.create(
                model=ROUTER_MODEL, 
                messages=[{"role": "user", "content": extraction_prompt}]
            )
            data = extract_json_safely(completion.choices[0].message.content) or {}
            target_id = data.get("target_id", "NONE")
        except:
            target_id = "NONE"

        if target_id == "NONE" or target_id == user_id:
             return {"final_response": "I couldn't figure out who you want to remove. Please specify a valid member name."}

        # 3. Logic Checks
        if target_id == target_team.members[0]:
             return {"final_response": "❌ You cannot remove the Team Leader."}

        # Check for duplicate active votes
        existing = next((r for r in target_team.member_requests if r.target_user_id == target_id and r.is_active), None)
        if existing:
            # --- FIX: Fetch Name for Display ---
            target_user_obj = await User.get(target_id)
            target_name = target_user_obj.username if target_user_obj else "Unknown Member"
            
            return {"final_response": f"⚠️ A vote to remove **{target_name}** is already active."}
        
        # 4. START VOTE (The Only Path Now)
        # We removed the 'planning' check, so this runs for everyone.
        req = MemberRequest(
            target_user_id=target_id, 
            type="remove", 
            explanation="Removed via AI Manager", 
            initiator_id=user_id, 
            votes={user_id: "approve"} # Leader automatically votes YES
        )
        target_team.member_requests.append(req)
        await target_team.save()
        
        # 5. Notify Team
        # We exclude the person being removed from the notification loop to avoid conflict,
        # but the remaining members will see the vote request.
        count = 0
        for m_id in target_team.members:
            if m_id != user_id and m_id != target_id:
                await Notification(
                    recipient_id=m_id, 
                    sender_id=user_id, 
                    message=f"🗳️ **Vote Started:** Proposal to REMOVE <@{target_id}> from '{target_team.name}'.", 
                    type="member_request", 
                    related_id=str(target_team.id)
                ).insert()
                count += 1

        target_user_obj = await User.get(target_id)
        target_name = target_user_obj.username if target_user_obj else "Unknown Member"
        return {"final_response": f"🗳️ **Vote Initiated.** I've started a vote to remove **{target_name}**. {count} other members have been notified."}    
    
    # --- BRANCH F: ASSIGN TASK ---
    if intent == "ASSIGN_TASK":
        if target_team.status == "planning":
            return {
                "final_response": (
                    f"❌ **Cannot Assign Task**\n\n"
                    f"The project **{target_team.name}** is still in the **Planning** phase.\n"
                    "You can only assign tasks once the project has officially started and is **Active**."
                )
            }
        # 1. Build Member List
        members_map = []
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u: members_map.append(f"{u.username} (ID: {str(u.id)})")
        
        # 2. Strict Prompt
        task_extraction_prompt = f"""
        Analyze this request: "{state['question']}"
        Context: Project "{target_team.name}"
        Team Members: {', '.join(members_map)}
        
        INSTRUCTIONS:
        - Extract the task description.
        - Find the assignee ID. 
        - If the user says "me", use ID "{user_id}".
        - If no specific person is named, use ID "{user_id}".
        - Default deadline is 3 days.
        
        OUTPUT FORMAT:
        Return ONLY valid JSON.
        {{
            "description": "...",
            "assignee_id": "...",
            "days": 3
        }}
        """
        
        try:
            # 1. REMOVED 'response_format' argument to fix the 400 Error
            completion = await client.chat.completions.create(
                model=MENTOR_MODEL,
                messages=[{"role": "user", "content": task_extraction_prompt}]
            )
            
            raw = completion.choices[0].message.content

            # Use the helper function already in your file
            data = extract_json_safely(completion.choices[0].message.content)
            
            # Safety check in case data is None
            if not data:
                raise ValueError("Could not extract valid JSON from AI response")
            
            # 3. Handle Assignee Fallback (Safety Check)
            assignee = data.get("assignee_id")
            if not assignee or assignee == "null":
                assignee = user_id # Default to self if AI gets confused

            # C. Create Task Object
            new_task = Task(
                description=data["description"],
                assignee_id=assignee,
                deadline=datetime.now() + timedelta(days=int(data.get("days", 3)))
            )
            
            # D. Save to DB
            target_team.tasks.append(new_task)
            await target_team.save()
            
            # E. Notify Assignee (if not self)
            if assignee != user_id:
                 await Notification(
                    recipient_id=assignee,
                    sender_id=user_id,
                    message=f"New AI Task in {target_team.name}: {data['description']}",
                    type="info",
                    related_id=str(target_team.id)
                ).insert()

            assignee_obj = await User.get(assignee)
            assignee_name = assignee_obj.username if assignee_obj else "Unknown Member"

            return {"final_response": f"✅ **Task Assigned!**\n\n📝 **{data['description']}**\n👤 Assignee: **{assignee_name}**\n📅 Deadline: {new_task.deadline.strftime('%Y-%m-%d')}"}
            
        except json.JSONDecodeError:
            print(f"JSON Parse Failed. Raw output: {raw}")
            return {"final_response": "I couldn't create the task. The AI response wasn't valid JSON."}
        except Exception as e:
            print(f"Task Error: {e}")
            return {"final_response": "Something went wrong while creating the task."}       
         
    # --- BRANCH G: EXTEND DEADLINE ---
    if intent == "EXTEND_DEADLINE":
        # 1. Filter: Only tasks assigned to THIS USER
        # This prevents the AI from seeing or selecting Julia's tasks.
        tasks_map = []
        for t in target_team.tasks:
            if t.assignee_id == user_id:
                # We include the ID so we can match it perfectly later
                tasks_map.append(f"ID: {str(t.id)} | Task: {t.description} | Due: {t.deadline.strftime('%Y-%m-%d')}")
        
        if not tasks_map:
             return {"final_response": "❌ You don't have any tasks in this project to extend. You can only request extensions for tasks assigned to **you**."}

        # 2. Extract Task ID
        extraction_prompt = f"""
        User Input: "{state['question']}"
        Available Tasks (User's Own): {json.dumps(tasks_map)}
        
        INSTRUCTIONS:
        - Identify the exact task ID based on the description or due date.
        - If there are multiple matching tasks (e.g. two tasks named "Backend"), use the date to decide.
        - If the user is vague and matches multiple tasks (e.g. "Extend the task" but there are 3 tasks), return "NONE".
        
        OUTPUT FORMAT:
        Return ONLY valid JSON.
        {{
            "task_id": "Exact ID from list",
            "days_to_add": 3
        }}
        """
        
        try:
            completion = await client.chat.completions.create(
                model=MENTOR_MODEL,
                messages=[{"role": "user", "content": extraction_prompt}]
            )
            # Use your helper function if available, otherwise manual clean
            raw = completion.choices[0].message.content
            clean_json = raw.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            
            target_id = data.get("task_id")
            days = int(data.get("days_to_add", 3))
        except: 
            return {"final_response": "I couldn't figure out which task you mean. Try 'Extend the Login task by 2 days'."}

        # 3. Find the Task Object by ID
        target_task = next((t for t in target_team.tasks if str(t.id) == target_id), None)
        
        if not target_task:
             return {"final_response": "❌ I couldn't find that task in your list."}

        # 4. Check Pending Requests
        # Note: Ensure your Team model has 'extension_requests' or logic to handle this
        if any(r for r in target_team.extension_requests if r.task_id == str(target_task.id) and r.is_active):
             return {"final_response": "⚠️ You already have a pending extension request for this task."}

        # 5. Logic: Solo vs Team
        new_deadline = target_task.deadline + timedelta(days=days)

        if len(target_team.members) == 1:
            # Instant update for solo projects
            target_task.deadline = new_deadline
            await target_team.save()
            return {"final_response": f"✅ **Deadline Extended.** The new deadline for '{target_task.description}' is {new_deadline.strftime('%Y-%m-%d')}."}
        else:
            # Vote for Team Projects
            req = ExtensionRequest(
                task_id=str(target_task.id),
                requested_deadline=new_deadline,
                initiator_id=user_id,
                votes={user_id: "approve"}
            )
            target_team.extension_requests.append(req)
            await target_team.save()

            # Notify Team
            for m_id in target_team.members:
                if m_id != user_id:
                    await Notification(
                        recipient_id=m_id, 
                        sender_id=user_id, 
                        message=f"Vote to EXTEND deadline for task '{target_task.description}'.", 
                        type="extension_request", 
                        related_id=str(target_team.id)
                    ).insert()
            
            return {"final_response": f"🗳️ **Vote Started.** You requested {days} extra days for '{target_task.description}'. Team members have been notified."}   
    
    # --- BRANCH H: SEND MESSAGE (ROBUST) ---
    if intent == "SEND_MESSAGE":
        # 1. Permission Check
        if target_team.members[0] != user_id:
             return {"final_response": "❌ Only the **Team Leader** can send notifications."}

        # 2. Build Context Maps
        id_to_name = {}
        name_to_id = {}
        members_list_str = []
        
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u: 
                id_to_name[str(u.id)] = u.username
                name_to_id[u.username.lower()] = str(u.id)
                members_list_str.append(f"{u.username} (ID: {str(u.id)})")

        # 3. FEW-SHOT PROMPT (The Solution)
        extraction_prompt = f"""
        Analyze this request: "{state['question']}"
        Current Project: "{target_team.name}"
        Team Members: {', '.join(members_list_str)}
        
        [EXAMPLES]
        Input: "Tell Julia from Tic-Tac-Toe that the meeting is at 5"
        Output: {{ "recipient_id": "ID_OF_JULIA", "message": "The meeting is at 5" }}
        
        Input: "Message everyone in Maze Solver to check emails"
        Output: {{ "recipient_id": "ALL", "message": "Check emails" }}

        [YOUR TASK]
        - Identify the recipient and message.
        - IGNORE the project name in the "from" or "in" clause.
        - If sending to everyone -> recipient_id = "ALL"
        - If sending to a person -> recipient_id = "THEIR EXACT ID"
        
        OUTPUT (JSON ONLY):
        """
        
        try:
            # FIX: REMOVED 'response_format' argument here!
            completion = await client.chat.completions.create(
                model=MENTOR_MODEL,
                messages=[{"role": "user", "content": extraction_prompt}]
            )
            
            # Debugging: Print what the AI actually said
            print(f"🕵️ AI Raw Output: {completion.choices[0].message.content}")
            
            # Safe Extract (Already correct in your code)
            data = extract_json_safely(completion.choices[0].message.content) or {}
            raw_recipient = data.get("recipient_id")
            message_text = data.get("message")
            
            if not raw_recipient or not message_text:
                raise ValueError("Missing data")

        except Exception as e: 
            print(f"❌ Extraction Failed: {e}")
            return {"final_response": "I couldn't figure out who to message. Try 'Tell John to...'"}

        # 4. SMART RESOLUTION (Logic remains the same)
        final_recipient_id = None
        
        if raw_recipient.upper() == "ALL":
            final_recipient_id = "ALL"
        elif raw_recipient in target_team.members:
            final_recipient_id = raw_recipient
        elif raw_recipient.lower() in name_to_id:
            final_recipient_id = name_to_id[raw_recipient.lower()]
        else:
            # Fuzzy Match
            for name, real_id in name_to_id.items():
                if raw_recipient.lower() in name:
                    final_recipient_id = real_id
                    break

        if not final_recipient_id:
             return {"final_response": f"❌ I found the message, but I can't find a member named '**{raw_recipient}**' in this team."}

        # 5. Execute Send
        if final_recipient_id == "ALL":
            count = 0
            for m_id in target_team.members:
                if m_id != user_id:
                    await Notification(
                        recipient_id=m_id, sender_id=user_id, 
                        message=f"📢 **Announcement:** {message_text}", 
                        type="info", related_id=str(target_team.id)
                    ).insert()
                    count += 1
            return {"final_response": f"📢 **Broadcast Sent.** Notified {count} members: *\"{message_text}\"*"}
        else:
            recipient_name = id_to_name.get(final_recipient_id, "Member")
            await Notification(
                recipient_id=final_recipient_id, sender_id=user_id, 
                message=f"📩 **Message from Leader:** {message_text}", 
                type="info", related_id=str(target_team.id)
            ).insert()
            return {"final_response": f"📩 **Message Sent.** Sent to **{recipient_name}**: *\"{message_text}\"*"}

    # --- BRANCH F: ANALYZE TEAM ---
    if intent == "ANALYZE_TEAM":
        print("📊 Analyzing Team Composition...")

        # 1. Safe Skill Extraction (Fixes the .lower() crash)
        # We ensure everything is a lowercase string for comparison
        needed_set = {get_skill_name(s).lower() for s in target_team.needed_skills}
        
        member_skills_set = set()
        roster_display = []
        
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u:
                # Safely process each skill for this user
                u_skill_names = [get_skill_name(s) for s in u.skills]
                
                # Add to our comparison set (lowercase)
                for name in u_skill_names:
                    member_skills_set.add(name.lower())
                
                # Add to the display list (original casing)
                roster_display.append(f"- **{u.username}**: {', '.join(u_skill_names)}")
        
        # 2. Calculate Gaps
        missing = [s.capitalize() for s in needed_set if s not in member_skills_set]
        covered = [s.capitalize() for s in needed_set if s in member_skills_set]
        
        # 3. Enhanced "Hiring Manager" Prompt
        # We ask for direct Text/Markdown, not JSON (Simpler & Faster)
        analysis_prompt = f"""
        You are an Expert Engineering Manager. Analyze this team structure.
        
        PROJECT: {target_team.name}
        
        REQUIRED TECH STACK:
        {', '.join([get_skill_name(s) for s in target_team.needed_skills])}
        
        CURRENT TEAM ROSTER:
        {chr(10).join(roster_display)}
        
        MISSING SKILLS:
        {', '.join(missing) if missing else "None"}
        
        INSTRUCTIONS:
        - If skills are missing, recommend specific roles to hire (e.g., "You need a Frontend Dev for React").
        - If the team is balanced, suggest next steps for development.
        - Keep it short, encouraging, and professional.
        - Use Markdown (bolding, bullet points).
        
        OUTPUT:
        Return ONLY the analysis text. Do not wrap in JSON.
        """
        
        try:
            completion = await client.chat.completions.create(
                model=MENTOR_MODEL,
                messages=[{"role": "user", "content": analysis_prompt}]
            )
            advice = completion.choices[0].message.content
            
            # Format the final response nicely
            final_output = (
                f"📊 **Team Analysis: {target_team.name}**\n\n"
                f"✅ **Covered:** {', '.join(covered)}\n"
                f"❌ **Missing:** {', '.join(missing) if missing else 'None'}\n\n"
                f"💡 **Mentor Insight:**\n{advice}"
            )
            return {"final_response": final_output}
            
        except Exception as e:
            print(f"Analyze Error: {e}")
            return {"final_response": f"⚠️ I couldn't finish the analysis. Error: {str(e)}"}
        
    # --- BRANCH: MANAGE RECRUITMENT (Team Setting) ---
    if intent == "MANAGE_RECRUITMENT":
        current_leader = str(target_team.leader_id).strip() if target_team.leader_id else ""
        current_user = str(user_id).strip()
        
        if current_leader != current_user:
             # Debugging: Print to console so you can see what went wrong
             print(f"❌ LEADER MISMATCH: Project Leader '{current_leader}' vs User '{current_user}'")
             return {"final_response": f"❌ **Permission Denied.**\n\nOnly the **Team Leader** can change recruitment status.\n(Current Leader ID: `{current_leader}`)"}

        # 2. Determine desired state (Open vs Close)
        # We look for keywords in the user's input to decide the action.
        text = state["question"].lower()
        should_open = any(word in text for word in ["open", "start", "resume", "looking"])
        should_close = any(word in text for word in ["stop", "close", "pause", "full"])
        
        if should_open:
            target_team.is_looking_for_members = True
            await target_team.save()
            await sync_data_to_chroma()
            msg = f"✅ **Recruitment Opened!**\n\n**{target_team.name}** is now visible in the Marketplace. Users can find and apply to your team."
        elif should_close:
            target_team.is_looking_for_members = False
            await target_team.save()
            await sync_data_to_chroma()
            msg = f"🚫 **Recruitment Paused.**\n\n**{target_team.name}** is now hidden from the Marketplace. No new applications will be received."
        else:
            # Fallback if the user just asked "Is recruitment open?"
            status = "Open" if target_team.is_looking_for_members else "Closed"
            return {"final_response": f"ℹ️ Recruitment is currently **{status}**.\n\nTo change it, say **'Stop recruiting'** or **'Open recruitment'**."}
            
        return {"final_response": msg}

async def coder_node(state: AgentState):
    """Handles Coding Requests with Context."""
    print("🔧 Coder Node Active")
    
    # 1. Build context from history
    messages_payload = [{"role": "system", "content": "You are an expert coding assistant. Provide clean code."}]
    
    # Add last 2 messages for context (so it knows what code to fix)
    if state.get("history"):
        messages_payload.extend(state["history"][-2:]) 
    
    messages_payload.append({"role": "user", "content": state["question"]})
    
    try:
        completion = await client.chat.completions.create(
            model=CODER_MODEL,
            messages=messages_payload
        )
        return {"final_response": completion.choices[0].message.content}
    except:
        return {"final_response": "I'm having trouble generating code right now."}

async def search_node(state: AgentState):
    """Handles Vector Search (Projects Only)."""
    print("🔍 Search Node Active")
    
    # 1. PRIVACY GUARD: Block "Member Search" requests
    # If the user explicitly asks for people/users, we block it to protect privacy.
    recruit_keywords = [
        "find member", "find developer", "recruit", "suggest candidate", 
        "looking for people", "find user", "search user", "show profile"
    ]
    
    if any(k in state["question"].lower() for k in recruit_keywords):
        return {
            "final_response": "🚫 **I cannot search for Members directly.**\n\nTo find teammates or developers, please use the **Recruit / Swipe Matching** feature on your Dashboard.\n\nI can only help you find **Projects** to join!"
        }

    # 2. FORCE FILTER TO 'TEAM'
    # Even if they didn't use a blocked keyword, we force the DB search to ONLY look at projects.
    # We never allow 'filter_type="user"' to run.
    filter_type = "team"
        
    # 3. Perform the Search
    # This finds projects matching the user's query (e.g., "React game", "Python AI")
    query = f"{state['question']} {', '.join(state['user_skills'])}"
    matches = await asyncio.to_thread(search_vectors, query, filter_type)
    
    if not matches:
        return {"final_response": "I couldn't find any matching projects right now."}
        
    # 4. Generate Recommendation
    context = "\n\n".join(matches)
    prompt = f"""
    Recommend the best fit from these PROJECT matches for the request: "{state['question']}"
    
    Matches:
    {context}
    
    Instructions:
    - Only recommend the projects listed above.
    - Focus on the Tech Stack and Description.
    - Do NOT mention specific user names or member details.
    """
    
    completion = await client.chat.completions.create(
        model=MENTOR_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"final_response": completion.choices[0].message.content}

# app/services/chatbot_services.py

async def data_analyst_node(state: AgentState):
    """Handles complex queries about project status."""
    print("🧠 Data Analyst Node Active")
    user_id = state["user_id"]
    
    # 1. Fetch User Identity
    try:
        current_user = await User.get(user_id)
        current_username = current_user.username if current_user else "the current user"
    except:
        current_username = "the current user"

    user_teams = await Team.find(Team.members == user_id).to_list()
    if not user_teams: return {"final_response": "You aren't part of any projects yet."}

    projects_data = []
    for team in user_teams:
        member_map = {}
        for m_id in team.members:
            u = await User.get(m_id)
            if u: member_map[str(u.id)] = u.username

        tasks_list = []
        for t in team.tasks:
            assignee_name = member_map.get(t.assignee_id, "Unknown")
            
            tasks_list.append({
                "description": t.description,
                "status": t.status,
                "assignee": assignee_name,
                "is_assigned_to_you": (t.assignee_id == user_id), # Renamed for clarity
                "deadline": t.deadline.strftime("%Y-%m-%d"),
                "is_extended": "Yes" if (t.extension_request or t.was_extended) else "No", 
            })

        projects_data.append({
            "project_name": team.name,
            "description": team.description,
            "tasks": tasks_list
        })

    # 2. Strict Natural Language Prompt
    system_prompt = f"""
    You are the Project Data Analyst.
    
    CURRENT USER: {current_username} (ID: {user_id})
    DATA SOURCE: {json.dumps(projects_data, indent=2)}
    USER QUERY: "{state['question']}"
    
    INSTRUCTIONS:
    1. ANALYZE:
       - Look for tasks where "is_assigned_to_you" is true.
       - If the user asks "Do I have tasks?", ONLY report these.
       - If "is_assigned_to_you" is false, do NOT list that task as theirs.
    
    2. STYLE GUIDELINES (CRITICAL):
       - Respond naturally like a human project manager.
       - 🚫 DO NOT mention "JSON", "fields", "is_me", "true/false", or "data source".
       - 🚫 DO NOT explain your filtering process (e.g., "I checked the data and...").
       - Just state the answer directly.
         - Good: "You have no pending tasks right now."
         - Bad: "Based on the is_assigned_to_you field being false, you have no tasks."
    """
    
    try:
        completion = await client.chat.completions.create(model=MENTOR_MODEL, messages=[{"role": "user", "content": system_prompt}])
        return {"final_response": completion.choices[0].message.content}
    except: return {"final_response": "I couldn't analyze the project data."}
    
async def chat_node(state: AgentState):
    """
    Handles General Conversation + Project Q&A.
    Uses VECTOR SEARCH to detect if the user wants to see their project list.
    """
    print("🤖 Chat Node Active (Mentor Mode)")
    
    user_id = state["user_id"]
    question = state["question"]
    
    # 1. Fetch User's Teams (Context)
    try:
        user_teams = await Team.find(Team.members == user_id).to_list()
    except:
        user_teams = []
    
    # 2. Analyze Request (The Smart Way)
    
    # A. Check for Specific Project (e.g., "Tell me about Maze Solver")
    # (This uses the smart helper we built earlier)
    mentioned_project = await find_relevant_project(question, user_teams)

    # B. Check for General "My Projects" Query (SEMANTIC MATCH)
    # instead of keywords, we compare meanings.
    # We define a few "anchor" sentences that represent this intent.
    general_anchors = [
        "what are my ongoing projects",
        "show me my project list",
        "what am I working on right now",
        "list my active teams",
        "tell me about my projects"
    ]
    
    # Calculate similarity against these anchors
    user_vec = generate_embedding(question)
    max_score = 0.0
    
    for anchor in general_anchors:
        anchor_vec = generate_embedding(anchor)
        score = calculate_similarity(user_vec, anchor_vec)
        if score > max_score:
            max_score = score
            
    # Threshold: 0.6 (60% similarity is usually a safe bet for "same meaning")
    is_general_query = max_score > 0.60
    
    # Debugging print to help you see the score
    if is_general_query:
        print(f"🎯 Detected Project List Request (Score: {max_score:.2f})")

    project_context = ""
    
    # --- SCENARIO 1: Specific Project ---
    if mentioned_project:
        print(f"💡 Context Injection: Found project '{mentioned_project.name}'")
        
        # 🔥 FIX: Use 'project_roadmap' instead of 'roadmap'
        # Handle cases where it might be a Dict, a List, or None
        roadmap_data = getattr(mentioned_project, "project_roadmap", None)
        roadmap_summary = "None"
        
        if roadmap_data:
            # If it's a list (legacy data), slice it. If it's a dict (model definition), dump it.
            if isinstance(roadmap_data, list):
                roadmap_summary = json.dumps(roadmap_data[:3])
            elif isinstance(roadmap_data, dict):
                # Try to get 'steps' or just dump the first few keys
                steps = roadmap_data.get("roadmap", roadmap_data.get("steps", []))
                if isinstance(steps, list):
                    roadmap_summary = json.dumps(steps[:3])
                else:
                    roadmap_summary = json.dumps(roadmap_data) # Fallback

        project_context = f"""
        --- ACTIVE PROJECT CONTEXT ---
        The user is asking about their project: "{mentioned_project.name}"
        Description: {mentioned_project.description}
        Tech Stack / Skills: {', '.join(mentioned_project.needed_skills)}
        Status: {mentioned_project.status}
        Pending Tasks: {len(mentioned_project.tasks)}
        Roadmap (Snapshot): {roadmap_summary}
        
        INSTRUCTION: Answer the user's question specifically using the project details above.
        ------------------------------
        """

    # --- SCENARIO 2: List All Projects ---
    elif is_general_query and user_teams:
        print(f"💡 Context Injection: Listing {len(user_teams)} Projects")
        
        summary_list = []
        for t in user_teams:
            summary_list.append(f"- {t.name}: {t.description} (Stack: {', '.join(t.needed_skills)})")
        
        project_context = f"""
        --- USER'S PROJECT LIST ---
        The user wants to know about their ongoing projects. Here they are:
        
        {chr(10).join(summary_list)}
        
        INSTRUCTION: Summarize these projects for the user. Tell them exactly what they are working on currently.
        ---------------------------
        """
        
    elif is_general_query and not user_teams:
        project_context = """
        --- NO PROJECTS FOUND ---
        The user asked for their projects, but they haven't joined any teams yet.
        INSTRUCTION: Kindly tell them they don't have any active projects and suggest they visit the Marketplace to join one.
        """
    
    # --- 1. DEFINE THE KNOWLEDGE BASE ---
    platform_guide = """
    COLLABQUEST PLATFORM GUIDELINES & SYSTEM LOGIC

    1. CORE PHILOSOPHY & NAVIGATION
    - Purpose: A gamified project collaboration platform to connect developers, form teams, and manage projects[cite: 78].
    - Global Navigation (Top Header):
      * Dashboard: Central hub for tasks and network[cite: 34].
      * Marketplace: Directory for finding projects ("Find Team")[cite: 78].
      * Recruit: Smart Match swipe interface for finding people.
      * Messages: Bubble icon (Red badge = unread chats)[cite: 255].
      * Profile Menu: Avatar (Top Right) -> Settings, Profile, Logout[cite: 256].

    2. FEATURE-SPECIFIC GUIDELINES

    A. The Dashboard (User Hub)
    - Access: Click "Dashboard" or the Logo[cite: 247].
    - Network Management:
      * Search: Find people by Name or Skill (e.g., "Python")[cite: 45, 46].
      * Connect: Click Purple "Connect" button[cite: 53].
      * Requests: Accept (Green Check) or Reject (Red X)[cite: 51].
    - Task Tracking:
      * Active Tasks: View assigned tasks across all projects[cite: 56].
      * Submit Work: Click Green "Mark Done" button for review[cite: 58].
    - Project Applications:
      * "Invited": Leader wants you -> Click Green "Join Team"[cite: 63, 64].
      * "Requested": You applied -> Wait for approval[cite: 65].

    B. The Marketplace (Find Projects)
    - Access: Click "Marketplace"[cite: 78].
    - Create a Project:
      * Action: Click Purple "+ Post Idea" button[cite: 82].
      * Inputs: Name, Description, Tech Stack[cite: 83].
      * Result: You become Leader of a "Planning" phase team[cite: 84].
    - Join a Project:
      * Filter: By "Recruiting Only" (Active teams) or Tech Stack[cite: 95, 96].
      * Apply: Click "View Project" -> Apply[cite: 100].

    C. Smart Match (Recruiting & Discovery)
    - Access: Click "Recruit" or Sparkles icon[cite: 85].
    - Two Modes:
      1. Recruit Mode: For Leaders finding developers. Swipe Right = Invite[cite: 107, 121].
      2. Find Projects Mode: For individuals. Swipe Right = Request Join[cite: 108, 122].
    - Controls:
      * Swipe Right (Green Check): Interest/Invite[cite: 121, 123].
      * Swipe Left (Red X): Pass/Skip[cite: 124, 125].

    D. Team Workspace (Project Management)
    - Access: Dashboard -> My Projects -> "Manage"[cite: 90].
    - Task Board:
      * Create: "+ New Task" -> Assign to member with deadline[cite: 214, 215].
      * Workflow: Pending -> In Review -> Completed[cite: 215, 216].
      * Approval: Only Leader can mark "Completed"[cite: 218].
    - Danger Zone (Voting System):
      * Delete Project: Leader initiates vote. Requires majority "Approve" from members. NOT instant if team > 1 person.
      * Complete Project: Leader initiates "Completion Vote"[cite: 253].

    E. Communication Suite
    - Access: "Messages" icon or "Chat" on profile[cite: 254].
    - Chat: Text, Emojis, File Attachments (Images/Video/Docs)[cite: 4].
    - Video/Audio Calls:
      * Start: Click Phone or Video icon in chat header[cite: 10, 11].
      * Screen Share: Only available during Video calls (Monitor icon)[cite: 14, 15].

    F. Profile & Trust Score
    - Access: Avatar -> "My Profile"[cite: 258].
    - Trust Score: 0-10 rating. Increases by linking accounts/verifying skills[cite: 26, 165].
    - Skill Verification: Must pass 15s/question quiz to get Verified Badge[cite: 171, 172].
    - Privacy: "Eye" icons in Settings hide Email/Education from public.

    3. CHATBOT ANTI-HALLUCINATION PROTOCOLS (STRICT)

    Protocol A: The "Existence" Rule
    - You must NEVER claim features exist if not listed here.
    - NO Direct Hiring: You cannot "hire" users directly. User must use "Recruit" tab[cite: 91].
    - NO Payment Processing: You cannot handle money/salaries.
    - NO Code Execution: You can write code, but cannot run/deploy it.
    - Correct Fail-Safe: "I cannot perform that action directly. You can access [Feature] via [Path]."

    Protocol B: "Recruit vs. Search" Distinction
    - If User asks to "Find Developers" or "Recruit Members":
      * ACTION: STOP. Do not search DB.
      * REPLY: "I cannot search private profiles. Please use the 'Recruit' tab (Smart Match) to swipe on candidates." 
    - If User asks to "Find a Project":
      * ACTION: PROCEED. Search Projects DB.
      * REPLY: "I found these projects matching your skills..." [cite: 108]

    Protocol C: The "Voting" Safety Net
    - Trigger: User says "Delete project" (and team size > 1).
    - REQUIRED Explanation: "Since you have team members, I cannot delete this immediately. I have initiated a Deletion Vote. Members must approve." [cite: 222]

    Protocol D: Accessibility Accuracy
    - If asked about accessibility, ONLY refer to "Selection Text-to-Speech"[cite: 191].
    - Explain: "Enable in Account Settings. Select text to hear it read aloud." [cite: 192]

    Protocol E: The "No-Fake-Actions" Rule (CRITICAL)
    - You are the MENTOR (Chat Mode). You DO NOT have write-access to the database.
    - If the user asks you to "Open Recruitment", "Delete Project", "Remove Member", or "Update Capacity":
      * YOU MUST REFUSE.
      * Do NOT say "I have updated the status."
      * Say: "I mistakenly received this request in Chat Mode. Please try stating the command clearer, like 'Manage recruitment for [Project Name]'."

    4. AI INTERACTION GUIDE (USER COMMANDS)
    - Start Project: "Create a new project named [Name]" [cite: 82]
    - Manage Team: "Remove [Member] from team" -> Starts Vote[cite: 211].
    - Leave Team: "Leave the [Project] team" -> Starts Vote (if Active)[cite: 223].
    - Tasks: "Assign task [Desc] to [User]" or "Extend deadline for [Task]"[cite: 215].
    - Broadcast: "Tell the team that [Message]"[cite: 254].
    - Status: "Mark project as complete" -> Starts Vote[cite: 253].
    - Data Query: "Who is overloaded?" or "Show my tasks"[cite: 56].
    """

    system_instruction = f"""
    You are CollabQuest Mentor Bot.
    User Context: ID {user_id}
    
    {project_context} 
    
    {platform_guide}

    SAFETY & CONDUCT GUIDELINES:
    - You are a professional mentor. NEVER generate hate speech, discrimination, or sexually explicit content.
    - If a user asks for malicious code (hacking, exploits), politely refuse.
    - If a user is hostile, remain calm and professional. Do not engage in arguments.
    - If a request violates these rules, reply: "I cannot assist with that request."
    
    FORMATTING RULES:
    - Use Markdown for styling.
    - Use **bold** for project names, key terms, or emphasis.
    - Use Numbered Lists (1., 2.) when explaining steps or listing items.
    - Use Bullet Points (- ) for unordered lists.
    - Keep paragraphs short and readable.
    
    INSTRUCTIONS:
    - If project context is provided above (Specific or List), USE IT to answer.
    - If no context, use the Platform Manual.
    """
    
    # 4. Generate Reply
    messages_payload = [{"role": "system", "content": system_instruction}]
    if state.get("history"):
        messages_payload.extend(state["history"])
    messages_payload.append({"role": "user", "content": state["question"]})

    try:
        completion = await client.chat.completions.create(
            model=MENTOR_MODEL,
            messages=messages_payload,
            extra_headers={"HTTP-Referer": "https://collabquest.com", "X-Title": "CollabQuest"}
        )
        return {"final_response": completion.choices[0].message.content}
    except Exception as e:
        print(f"Chat Node Error: {e}")
        return {"final_response": "I'm having trouble connecting right now."}
    
# --- 3. BUILD THE GRAPH ---

workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("router", router_node)
workflow.add_node("planner", planner_node)
workflow.add_node("manager", manager_node)
workflow.add_node("coder", coder_node)
workflow.add_node("searcher", search_node)
workflow.add_node("chatter", chat_node)
workflow.add_node("data_analyst", data_analyst_node)

# Set Entry Point
workflow.set_entry_point("router")

# Define Logic (The Conditional Edges)
def route_decision(state):
    i = state["intent"]
    if i == "CREATE_PROJECT": return "planner"
    if i == "PROJECT_QUERY": return "data_analyst"
    if i in ["DELETE_PROJECT", "COMPLETE_PROJECT", "LEAVE_TEAM", "REMOVE_MEMBER", "ASSIGN_TASK", "EXTEND_DEADLINE", "SHOW_TASKS", "SEND_MESSAGE", "DAILY_BRIEFING", "ANALYZE_TEAM", "MANAGE_RECRUITMENT"]: return "manager"
    if i == "CODE_REQUEST": return "coder"
    if i == "SEARCH_REQUEST": return "searcher"
    return "chatter"

workflow.add_conditional_edges(
    "router",
    route_decision,
    {
        "planner": "planner",
        "data_analyst": "data_analyst",
        "manager": "manager",
        "coder": "coder",
        "searcher": "searcher",
        "chatter": "chatter"
    }
)

# All nodes end after they work
workflow.add_edge("planner", END)
workflow.add_edge("data_analyst", END)
workflow.add_edge("manager", END)
workflow.add_edge("coder", END)
workflow.add_edge("searcher", END)
workflow.add_edge("chatter", END)

# Compile
app = workflow.compile()

# --- 4. EXPORT THE MAIN FUNCTION ---

async def generate_chat_reply(question: str, user_skills: list[str], user_id: str):
    """
    Entry point. Fetches history, runs graph, yields stream.
    """
    
    # 1. Fetch History
    try:
        past_msgs_db = await ChatMessage.find(ChatMessage.user_id == user_id)\
            .sort("-timestamp").limit(15).to_list()
        past_msgs_db.reverse()
        
        formatted_history = []
        for m in past_msgs_db:
             formatted_history.append({"role": "user", "content": m.question})
             formatted_history.append({"role": "assistant", "content": m.answer})
    except:
        formatted_history = []

    # 2. Build State
    inputs = {
        "question": question,
        "user_skills": user_skills,
        "user_id": user_id,
        "intent": "",
        "final_response": "",
        "history": formatted_history,
        "is_confirmed": False
    }
    
    # 3. Run Graph
    result = await app.ainvoke(inputs)
    
    # 4. Return result
    return result["final_response"]