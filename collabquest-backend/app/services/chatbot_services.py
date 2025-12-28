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
from app.services.recommendation_service import search_vectors
from app.services.vector_store import generate_embedding, calculate_similarity

INTENT_EXAMPLES = {
    "CREATE_PROJECT": [
        "create a new project", "start a team", "post an idea", "build a new app", "launch a startup", "I have an idea for a project"
    ],
    "DELETE_PROJECT": [
        "delete this project", "remove this team", "cancel the project", "destroy the group", "delete my project"
    ],
    "COMPLETE_PROJECT": [
        "mark as complete", "finish the project", "we are done", "project is finished", "close the project"
    ],
    "LEAVE_TEAM": [
        "leave the team", "quit this project", "exit the group", "resign from team", "remove me from this project"
    ],
    "REMOVE_MEMBER": [
        "remove a member", "kick someone out", "fire a developer", "ban a user", "remove him from the team"
    ],
    "ASSIGN_TASK": [
        "assign a task", "give a job to someone", "create a to-do item", "delegate this work", "add a task for her"
    ],
    "EXTEND_DEADLINE": [
        "extend the deadline", "push back the date", "need more time", "change the due date", "postpone the task"
    ],
    "SHOW_TASKS": [
        "show my tasks", "what do i need to do", "check my todo list", "pending work", "my assignments"
    ],
    "DAILY_BRIEFING": [
        "daily briefing", "what did i miss", "show notifications", "any updates", "summarize my day"
    ],
    "ANALYZE_TEAM": [
        "analyze the team", "check skill gaps", "what skills are missing", "evaluate our roster", "team analysis"
    ],
    "SEND_MESSAGE": [
        "send a message", "tell the team", "broadcast an announcement", "message him", "notify everyone"
    ],
    "CODE_REQUEST": [
        "write python code", "fix this bug", "debug this function", "how do I code this", "generate a script"
    ],
    "SEARCH_REQUEST": [
        "find a project", "search for teams", "projects using react", "looking for a team to join"
    ],
    "GENERAL_QUERY": [
        "Hello, how are you?", 
        "tell me about my ongoing projects",  # <--- ADD THIS
        "what projects am I working on?",     # <--- ADD THIS
        "list my projects",                   # <--- ADD THIS
        "who are you?",
        "what can you do?"
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

    [CATEGORIES]
    - CREATE_PROJECT
    - DELETE_PROJECT
    - COMPLETE_PROJECT
    - LEAVE_TEAM
    - REMOVE_MEMBER
    - ASSIGN_TASK
    - EXTEND_DEADLINE
    - SHOW_TASKS
    - DAILY_BRIEFING
    - ANALYZE_TEAM
    - SEND_MESSAGE
    - CODE_REQUEST
    - SEARCH_REQUEST
    - GENERAL_QUERY

    [FEW-SHOT EXAMPLES]
    Input: "I want to build a React app" -> CREATE_PROJECT
    Input: "I'm done with this project" -> COMPLETE_PROJECT
    Input: "Kick John out of the group" -> REMOVE_MEMBER
    Input: "Tell everyone the meeting is at 5" -> SEND_MESSAGE
    Input: "How do I center a div?" -> CODE_REQUEST
    Input: "Find me a team doing AI" -> SEARCH_REQUEST
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
        return {"final_response": f"I'm not sure which project you mean. I can see these projects: **{', '.join([t.name for t in relevant_teams])}**"}
    
    # Check locked status
    if target_team.status == "completed" and intent != "DELETE_PROJECT":
        return {"final_response": f"❌ Project **{target_team.name}** is already completed and locked."}

    if not target_team:
        # 🔥 NEW: Instructional Error Message
        action_instruction = ""
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
        else:
            action_instruction = "Manage [Project Name]"

        return {
            "final_response": f"I'm not sure which project you mean. Please try again with the full command:\n\n👉 **'{action_instruction}'**"
        }

    # --- BRANCH A: DELETE PROJECT ---
    if intent == "DELETE_PROJECT":
        # Case 1: Solo Project (Delete Immediately)
        if len(target_team.members) == 1:
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
            return {"final_response": f"⚠️ A vote to remove <@{target_id}> is already active."}

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

        return {"final_response": f"🗳️ **Vote Initiated.** I've started a vote to remove <@{target_id}>. {count} other members have been notified."}    
    
    # --- BRANCH F: ASSIGN TASK ---
    if intent == "ASSIGN_TASK":
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

            return {"final_response": f"✅ **Task Assigned!**\n\n📝 **{data['description']}**\n👤 Assignee: <@{assignee}>\n📅 Deadline: {new_task.deadline.strftime('%Y-%m-%d')}"}
            
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
                reason="Requested via AI Chat",
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
    PLATFORM MANUAL FOR COLLABQUEST
    1. FINDING AND JOINING TEAMS
    To find a team, users should go to the Marketplace page where they can browse active project cards.
    To quickly find projects, users can use the Smart Match feature. Swiping right applies to the project, and swiping left passes.
    To check application status, users should visit the Dashboard and look under the My Applications section to see if they are Pending, Joined, or Rejected.

    2. CREATING AND RECRUITING
    To create a team, users must go to the Marketplace page and click the Post Idea button.
    To recruit developers, Team Leaders can use the Recruit page to swipe on candidates.
    Only Team Leaders can recruit or manage the team settings.

    3. PROFILE AND SKILLS
    To edit a profile, users should go to the My Profile page to update their bio, interests, and availability.
    To verify a skill, users must go to My Profile, add a skill, and click the Verify button to take a quiz.
    If a user fails a verification quiz, they can try again later.
    The Trust Score is a reliability rating from 0 to 10 that increases by verifying skills and completing projects.

    4. COMMUNICATION AND TOOLS
    To chat, users can click the Messages button in the header.
    To send an email, users can click the Mail icon on any user or project card.
    To check notifications, users should click the Bell Icon. This is where they accept Team Invites and Vote on team decisions.
    To set availability, users should go to the Weekly Availability section in their Profile.
    To log out, users must click their Profile Picture in the top right corner and select Logout.

    5. MANAGING TEAMS
    To leave a team, users must go to the Team Details page.
    Major actions like Deleting a Team or Marking a Project Complete require a democratic vote from all members.
    To re-apply after being rejected, users can go to the Dashboard and click the Reset button on the application.
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

# Set Entry Point
workflow.set_entry_point("router")

# Define Logic (The Conditional Edges)
def route_decision(state):
    i = state["intent"]
    if i == "CREATE_PROJECT": return "planner"
    if i in ["DELETE_PROJECT", "COMPLETE_PROJECT", "LEAVE_TEAM", "REMOVE_MEMBER", "ASSIGN_TASK", "EXTEND_DEADLINE", "SHOW_TASKS", "SEND_MESSAGE", "DAILY_BRIEFING", "ANALYZE_TEAM"]: return "manager"
    if i == "CODE_REQUEST": return "coder"
    if i == "SEARCH_REQUEST": return "searcher"
    return "chatter"

workflow.add_conditional_edges(
    "router",
    route_decision,
    {
        "planner": "planner",
        "manager": "manager",
        "coder": "coder",
        "searcher": "searcher",
        "chatter": "chatter"
    }
)

# All nodes end after they work
workflow.add_edge("planner", END)
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
            .sort("-timestamp").limit(6).to_list()
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
        "history": formatted_history
    }
    
    # 3. Run Graph
    result = await app.ainvoke(inputs)
    
    # 4. Return result
    return result["final_response"]