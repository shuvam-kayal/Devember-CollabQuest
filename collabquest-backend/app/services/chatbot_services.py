import os
import asyncio
import json
from typing import TypedDict, Literal
from datetime import datetime, timedelta

from openai import AsyncOpenAI
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END

from app.models import ChatMessage, Team, DeletionRequest, Notification, Task, User, CompletionRequest, MemberRequest, Match, ExtensionRequest
from app.services.recommendation_service import search_vectors

load_dotenv()

# --- CONFIGURATION ---
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

# Models
ROUTER_MODEL = "arcee-ai/trinity-mini:free"
CODER_MODEL = "xiaomi/mimo-v2-flash:free"
MENTOR_MODEL = "allenai/olmo-3.1-32b-think:free" 

# --- 1. DEFINE THE STATE (The Memory of the Graph) ---
class AgentState(TypedDict):
    question: str
    user_id: str
    user_skills: list[str]
    intent: str
    final_response: str

# --- 2. DEFINE THE NODES (The Agents) ---

# app/services/chatbot_services.py

# ... existing imports ...

# REPLACE the router_node function with this:
async def router_node(state: AgentState):
    """Decides which path to take."""
    print(f"🧠 Routing: {state['question'][:30]}...")
    
    # 🔥 FIX: Use a simple string instead of ChatPromptTemplate
    router_prompt = """You are a Router. Classify the user input into EXACTLY ONE category:
    - CREATE_PROJECT (User wants to start/post a project)
    - DELETE_PROJECT (User wants to delete, remove, or cancel a project)
    - COMPLETE_PROJECT (User wants to mark a project as finished, done, or completed)
    - LEAVE_TEAM (User wants to leave, quit, or exit a team/project)
    - REMOVE_MEMBER (User wants to kick, remove, or fire a member from a team)
    - TRANSFER_LEADERSHIP (User wants to make someone else the leader, owner, or admin)
    - ASSIGN_TASK (User wants to assign, give, or create a task for someone)
    - EXTEND_DEADLINE (User wants to change, push back, or extend a task deadline)
    - SHOW_TASKS (User wants to see their assigned tasks, to-do list, or pending work)
    - DAILY_BRIEFING (User wants a summary of notifications, updates, or what they missed)
    - ANALYZE_TEAM (User wants to check skill gaps, team composition, or staffing needs)
    - SEND_MESSAGE (User wants to send a message/notification to a specific member OR the whole team)
    - CODE_REQUEST (User asks for code/debugging)
    - SEARCH_REQUEST (User wants to find/join teams)
    - GENERAL_QUERY (Greetings, platform questions)
    
    User Input: {question}
    
    Respond with ONLY the category name."""
    
    # 🔥 FIX: Synchronous standard python formatting
    chain_input = router_prompt.format(question=state["question"])
    
    try:
        completion = await client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[{"role": "user", "content": chain_input}],
            temperature=0.0
        )
        intent = completion.choices[0].message.content.strip().upper()
    except:
        intent = "GENERAL_QUERY"
        
    # Safety Check
    if intent not in ["CREATE_PROJECT", "DELETE_PROJECT", "COMPLETE_PROJECT", "LEAVE_TEAM", "REMOVE_MEMBER",
                      "TRANSFER_LEADERSHIP", "ASSIGN_TASK", "EXTEND_DEADLINE", "SHOW_TASKS",
                      "DAILY_BRIEFING", "ANALYZE_TEAM", "SEND_MESSAGE",
                      "CODE_REQUEST", "SEARCH_REQUEST", "GENERAL_QUERY"]:
        intent = "GENERAL_QUERY"
        
    return {"intent": intent}

async def planner_node(state: AgentState):
    """Handles Project Creation Logic."""
    print("🚀 Planner Node Active")
    
    system_prompt = """
    You are a Technical Project Manager.
    Convert the idea: "{idea}" into a JSON Project Plan.
    JSON Format: {{ "name": "...", "description": "...", "needed_skills": ["..."], "roadmap": ["..."] }}
    """
    
    try:
        completion = await client.chat.completions.create(
            model=MENTOR_MODEL,
            messages=[{"role": "user", "content": system_prompt.format(idea=state["question"])}]
        )
        raw_text = completion.choices[0].message.content
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        
        # Database Action
        new_team = Team(
            name=data["name"],
            description=data["description"],
            leader_id=state["user_id"],
            needed_skills=data["needed_skills"],
            members=[state["user_id"]],
            roadmap=data.get("roadmap", [])
        )
        await new_team.insert()
        
        response = f"✅ Created **{data['name']}**!\nStack: {', '.join(data['needed_skills'])}"
    except Exception as e:
        response = "I tried to create the project but hit a snag. Please try again."
        
    return {"final_response": response}

async def manager_node(state: AgentState):
    """Handles Project Management (All Actions)."""
    print("👔 Manager Node Active")
    user_id = state["user_id"]
    intent = state["intent"]
    
  # 1. Fetch relevant projects
    # Members can access these features. Leaders can do everything.
    member_allowed = ["LEAVE_TEAM", "EXTEND_DEADLINE", "SHOW_TASKS", "ANALYZE_TEAM", "DAILY_BRIEFING"]
    
    if intent in member_allowed:
        relevant_teams = await Team.find(Team.members == user_id).to_list()
        error_msg = "You are not part of any teams right now."
    else:
        relevant_teams = await Team.find(Team.members[0] == user_id).to_list()
        error_msg = "You can only manage projects where you are the Team Leader."

    if not relevant_teams:
        return {"final_response": error_msg}
    
            # --- BRANCH I: SHOW MY TASKS ---
    if intent == "SHOW_TASKS":
        my_tasks = []
        
        # 1. Loop through ALL teams the user is in
        for team in relevant_teams:
            for task in team.tasks:
                # Check if assigned to user (and optionally if not completed)
                if task.assignee_id == user_id:
                    # Format: "Task Name (Project Name) - Due: Date"
                    due_date = task.deadline.strftime('%Y-%m-%d')
                    my_tasks.append(f"• **{task.description}** (in *{team.name}*) — 📅 Due {due_date}")

        if not my_tasks:
            return {"final_response": "🎉 **You're all caught up!** You have no pending tasks assigned to you."}
        
        formatted_list = "\n".join(my_tasks)
        return {"final_response": f"📋 **Your To-Do List:**\n\n{formatted_list}"}

    if intent == "DAILY_BRIEFING":
        # Fetch last 10 notifications for user
        notifs = await Notification.find(Notification.recipient_id == user_id).sort("-timestamp").limit(10).to_list()
        
        if not notifs:
            return {"final_response": "📭 **No new updates.** You are all caught up!"}
        
        # Format for AI
        notif_text = "\n".join([f"- {n.message} ({n.timestamp.strftime('%Y-%m-%d %H:%M')})" for n in notifs])
        
        summary_prompt = f"""
        User ID: {user_id}
        Summarize these notifications into a natural, friendly paragraph (Briefing style).
        Group related items.
        
        Notifications:
        {notif_text}
        """
        try:
            completion = await client.chat.completions.create(model=MENTOR_MODEL, messages=[{"role": "user", "content": summary_prompt}])
            summary = completion.choices[0].message.content
            return {"final_response": f"🗞️ **Daily Briefing:**\n\n{summary}"}
        except:
             return {"final_response": "I couldn't summarize your notifications right now."}
        
    # 2. Identify Target Project
    team_names = [t.name for t in relevant_teams]
    project_prompt = f"""
    User Input: "{state['question']}"
    User's Projects: {', '.join(team_names)}
    
    Which project is the user talking about? Return JUST the exact name.
    If ambiguous or not found, return "NONE".
    """
    try:
        completion = await client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[{"role": "user", "content": project_prompt}],
            temperature=0.0
        )
        target_name = completion.choices[0].message.content.strip()
    except:
        target_name = "NONE"

    target_team = next((t for t in relevant_teams if t.name.lower() == target_name.lower()), None)

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
        elif intent == "TRANSFER_LEADERSHIP": 
            action_instruction = "Make [Member Name] leader of [Project Name]"
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
    
    # Check if already completed (unless we are trying to delete it, which is handled in branch A)
    if target_team.status == "completed" and intent != "DELETE_PROJECT":
        return {"final_response": f"❌ Project **{target_team.name}** is already completed and locked."}

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
        # A. Fetch Member Names
        members_map = []
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u:
                members_map.append(f"{u.username} (ID: {str(u.id)})")
        
        # B. Identify who to remove
        extraction_prompt = f"""
        User Input: "{state['question']}"
        Team Members: {', '.join(members_map)}
        
        Which member does the user want to remove? 
        Return JSON: {{ "target_id": "..." }}
        If self-referencing or unclear, return "NONE".
        """
        try:
            completion = await client.chat.completions.create(
                model=ROUTER_MODEL,
                messages=[{"role": "user", "content": extraction_prompt}]
            )
            raw = completion.choices[0].message.content
            clean_json = raw.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            target_id = data.get("target_id")
        except:
            target_id = "NONE"

        if target_id == "NONE" or target_id == user_id:
             return {"final_response": "I couldn't figure out who you want to remove. Please specify a valid member name."}

        # C. Execute Logic
        if target_id == target_team.members[0]:
             return {"final_response": "❌ You cannot remove the Team Leader."}

        # Scenario 1: Planning Phase (Instant Removal)
        if target_team.status == "planning":
            if target_id in target_team.members:
                target_team.members.remove(target_id)
                await target_team.save()
                
                await Match.find(Match.project_id == str(target_team.id), Match.user_id == target_id).delete()
                await Notification(
                    recipient_id=target_id, 
                    sender_id=user_id, 
                    message=f"You were removed from project '{target_team.name}'.", 
                    type="info"
                ).insert()
                
                return {"final_response": f"👋 **Removed.** I have removed <@{target_id}> from the team immediately since you are still in the planning phase."}

        # Scenario 2: Active Phase (Vote Required)
        else:
            existing = next((r for r in target_team.member_requests if r.target_user_id == target_id and r.is_active), None)
            if existing:
                return {"final_response": f"⚠️ A vote to remove <@{target_id}> is already active."}

            # 🔥 UPDATED LOGIC HERE 🔥
            req = MemberRequest(
                target_user_id=target_id, 
                type="remove", 
                explanation="Removed via AI Manager", 
                initiator_id=user_id, 
                votes={} # 1️⃣ Votes started at 0 (No default vote)
            )
            target_team.member_requests.append(req)
            await target_team.save()
            
            for m_id in target_team.members:
                # 2️⃣ Exclude the target user from notifications
                if m_id != user_id and m_id != target_id:
                    await Notification(
                        recipient_id=m_id, 
                        sender_id=user_id, 
                        message=f"Vote initiated to REMOVE a member from '{target_team.name}'.", 
                        type="member_request", 
                        related_id=str(target_team.id)
                    ).insert()

            return {"final_response": f"🗳️ **Vote Started.** I've initiated a vote to remove <@{target_id}>. Other members have been notified (Target excluded)."}    
    
    # --- BRANCH E: TRANSFER LEADERSHIP (NEW) ---
    if intent == "TRANSFER_LEADERSHIP":
        # 1. Permission Check
        if target_team.members[0] != user_id:
             return {"final_response": "❌ Only the **Team Leader** can transfer leadership."}

        # 2. Extract New Leader
        members_map = []
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u: members_map.append(f"{u.username} (ID: {str(u.id)})")

        extraction_prompt = f"""
        User Input: "{state['question']}"
        Team Members: {', '.join(members_map)}
        
        Who should be the new leader? 
        Return JSON: {{ "target_id": "..." }}
        """
        try:
            completion = await client.chat.completions.create(model=ROUTER_MODEL, messages=[{"role": "user", "content": extraction_prompt}])
            clean_json = completion.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            target_id = data.get("target_id")
        except: target_id = "NONE"

        if target_id == "NONE" or target_id == user_id:
             return {"final_response": "I couldn't figure out who you want to transfer leadership to. Please specify a valid team member."}
        
        # 3. Perform Transfer
        if target_id not in target_team.members:
             return {"final_response": "❌ That user is not in this team."}

        # Swap: Remove new leader, Insert at index 0
        target_team.members.remove(target_id)
        target_team.members.insert(0, target_id)
        await target_team.save()
        
        # Notify New Leader
        await Notification(
            recipient_id=target_id, 
            sender_id=user_id, 
            message=f"👑 You have been promoted to Team Leader of '{target_team.name}'!", 
            type="info"
        ).insert()
        
        return {"final_response": f"👑 **Leadership Transferred.** <@{target_id}> is now the new Team Leader of **{target_team.name}**."}

    # --- BRANCH F: ASSIGN TASK ---
    if intent == "ASSIGN_TASK":
        # A. Fetch Member Names
        members_map = []
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u:
                members_map.append(f"{u.username} (ID: {str(u.id)})")
        
        # B. Extract Task Details
        task_extraction_prompt = f"""
        Extract task details from: "{state['question']}"
        Team Members: {', '.join(members_map)}
        
        Return JSON object with fields:
        - "description": The task description
        - "assignee_id": The exact ID of the member to assign (pick best match from list, default to user_id if self)
        - "days": Number of days until deadline (default to 3 if not specified)
        
        Example JSON: {{ "description": "Fix bug", "assignee_id": "123", "days": 2 }}
        """
        
        try:
            completion = await client.chat.completions.create(
                model=MENTOR_MODEL,
                messages=[{"role": "user", "content": task_extraction_prompt}]
            )
            raw = completion.choices[0].message.content
            clean_json = raw.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            
            # C. Create Task Object
            new_task = Task(
                description=data["description"],
                assignee_id=data["assignee_id"],
                deadline=datetime.now() + timedelta(days=int(data.get("days", 3)))
            )
            
            # D. Save to DB
            target_team.tasks.append(new_task)
            await target_team.save()
            
            # E. Notify Assignee
            if data["assignee_id"] != user_id:
                await Notification(
                    recipient_id=data["assignee_id"],
                    sender_id=user_id,
                    message=f"New AI Task in {target_team.name}: {data['description']}",
                    type="info",
                    related_id=str(target_team.id)
                ).insert()

            return {"final_response": f"✅ **Task Assigned!**\n\n📝 **{data['description']}**\n👤 Assignee: <@{data['assignee_id']}>\n📅 Deadline: {new_task.deadline.strftime('%Y-%m-%d')}"}
            
        except Exception as e:
            print(f"Task Error: {e}")
            return {"final_response": "I understood the project, but failed to parse the task details. Try: 'Assign [Task] to [Person] in [Project]'."}

    # --- BRANCH G: EXTEND DEADLINE ---
    if intent == "EXTEND_DEADLINE":
        # 1. Identify Task and New Date
        tasks_list = [f"Desc: {t.description} | ID: {str(t.id)}" for t in target_team.tasks]
        
        extraction_prompt = f"""
        User Input: "{state['question']}"
        Available Tasks: {json.dumps(tasks_list)}
        
        Identify which task the user wants to extend and how many EXTRA days.
        Return JSON: {{ "task_description": "Exact text from list", "days_to_add": 3 }}
        """
        try:
            completion = await client.chat.completions.create(model=MENTOR_MODEL, messages=[{"role": "user", "content": extraction_prompt}])
            clean_json = completion.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            target_desc = data.get("task_description")
            days = int(data.get("days_to_add", 3))
        except: 
            return {"final_response": "I couldn't figure out which task you want to extend. Please say something like 'Extend the Login Page task by 2 days'."}

        # 2. Find the Task Object
        target_task = next((t for t in target_team.tasks if t.description == target_desc), None)
        if not target_task:
             return {"final_response": f"❌ I couldn't find the task '{target_desc}' in this project."}

        # 3. SECURITY: Only Assignee can request extension
        if target_task.assignee_id != user_id:
             return {"final_response": f"🚫 **Access Denied.** You can only request extensions for tasks assigned to **YOU**. This task belongs to <@{target_task.assignee_id}>."}

        # 4. Check Pending Requests
        if any(r for r in target_team.extension_requests if r.task_id == str(target_task.id) and r.is_active):
             return {"final_response": "⚠️ There is already an active extension request for this task."}

        # 5. Logic: Solo vs Team
        new_deadline = target_task.deadline + timedelta(days=days)

        if len(target_team.members) == 1:
            # Instant update for solo
            target_task.deadline = new_deadline
            await target_team.save()
            return {"final_response": f"✅ **Deadline Extended.** The new deadline for '{target_task.description}' is {new_deadline.strftime('%Y-%m-%d')}."}
        else:
            # Vote for Team
            req = ExtensionRequest(
                task_id=str(target_task.id),
                requested_deadline=new_deadline,
                reason="Requested via AI Chat",
                initiator_id=user_id,
                votes={}
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
            
            return {"final_response": f"🗳️ **Vote Started.** You requested {days} extra days. Team members have been notified to vote."}

    if intent == "SEND_MESSAGE":
        # 1. Permission Check (Leader Only)
        if target_team.members[0] != user_id:
             return {"final_response": "❌ Only the **Team Leader** can send notifications to the team."}

        # 2. Get Members for Prompt
        members_map = []
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u: members_map.append(f"{u.username} (ID: {str(u.id)})")

        # 3. AI Extraction
        extraction_prompt = f"""
        User Input: "{state['question']}"
        Current Project Context: "{target_team.name}"
        Team Members: {', '.join(members_map)}
        
        Task: Identify the recipient and the message.
        - The user might mention the project (e.g., "in {target_team.name}"), IGNORE that in the message text.
        - If sending to everyone/team/all -> recipient_id = "ALL"
        - If sending to one person -> recipient_id = "Specific ID from list"
        
        Return JSON: {{ "recipient_id": "...", "message": "..." }}
        """
        try:
            completion = await client.chat.completions.create(model=MENTOR_MODEL, messages=[{"role": "user", "content": extraction_prompt}])
            clean_json = completion.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            recipient_id = data.get("recipient_id")
            message_text = data.get("message")
        except: 
            return {"final_response": "I couldn't figure out who to message. Try 'Tell John to...' or 'Tell everyone...'"}

        # 4. Logic
        if recipient_id == "ALL":
            # Broadcast to Everyone
            count = 0
            for m_id in target_team.members:
                if m_id != user_id:
                    await Notification(recipient_id=m_id, sender_id=user_id, message=f"📢 **Announcement:** {message_text}", type="info", related_id=str(target_team.id)).insert()
                    count += 1
            return {"final_response": f"📢 **Broadcast Sent.** Notified {count} members: *\"{message_text}\"*"}
        
        else:
            # Send to One Person
            if recipient_id not in target_team.members:
                 return {"final_response": "❌ That user is not in this team."}
            
            await Notification(recipient_id=recipient_id, sender_id=user_id, message=f"📩 **Message from Leader:** {message_text}", type="info", related_id=str(target_team.id)).insert()
            return {"final_response": f"📩 **Message Sent.** Sent to <@{recipient_id}>: *\"{message_text}\"*"}

    if intent == "ANALYZE_TEAM":
        needed = set([s.lower() for s in target_team.needed_skills])
        member_skills = set()
        roster = []
        
        for m_id in target_team.members:
            u = await User.get(m_id)
            if u:
                u_skills = [s.lower() for s in u.skills]
                member_skills.update(u_skills)
                roster.append(f"{u.username} ({', '.join(u.skills)})")
        
        missing = [s.capitalize() for s in needed if s not in member_skills]
        covered = [s.capitalize() for s in needed if s in member_skills]
        
        analysis_prompt = f"""
        Project: {target_team.name}
        Required Skills: {', '.join(target_team.needed_skills)}
        Current Roster: {'; '.join(roster)}
        Missing Skills: {', '.join(missing)}
        Write a short, professional analysis. Advise on recruiting for missing skills.
        """
        try:
            completion = await client.chat.completions.create(model=MENTOR_MODEL, messages=[{"role": "user", "content": analysis_prompt}])
            advice = completion.choices[0].message.content
            return {"final_response": f"📊 **Team Analysis for {target_team.name}**\n\n✅ **Covered:** {', '.join(covered)}\n❌ **Missing:** {', '.join(missing) if missing else 'None'}\n\n💡 **Insight:**\n{advice}"}
        except: return {"final_response": "Analysis failed."}

    return {"final_response": "I'm not sure what management action you wanted to take."}

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
    Handles General Conversation.
    Uses the history ALREADY loaded in state['history'].
    """
    print("🤖 Chat Node Active (Mentor Mode)")
    
    user_id = state["user_id"]
    user_skills = state["user_skills"]
    
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
    User Context: ID {user_id}, Skills: {", ".join(user_skills) if user_skills else "Beginner"}
    {platform_guide}
    INSTRUCTIONS:
    - If user asks about Platform, use the Manual.
    - If user asks for code, provide it.
    """
    
    # --- 2. USE EXISTING HISTORY (No DB Call!) ---
    # Start with System Prompt
    messages_payload = [{"role": "system", "content": system_instruction}]
    
    # Add History from State (This comes from generate_chat_reply)
    if state.get("history"):
        messages_payload.extend(state["history"])
        
    # Add Current Question
    messages_payload.append({"role": "user", "content": state["question"]})

    # --- 3. GENERATE REPLY ---
    try:
        completion = await client.chat.completions.create(
            model=MENTOR_MODEL,
            messages=messages_payload,
            extra_headers={
                "HTTP-Referer": "https://collabquest.com",
                "X-Title": "CollabQuest"
            }
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
    if i in ["DELETE_PROJECT", "COMPLETE_PROJECT", "LEAVE_TEAM", "REMOVE_MEMBER", "TRANSFER_LEADERSHIP", "ASSIGN_TASK", "EXTEND_DEADLINE", "SHOW_TASKS", "SEND_MESSAGE", "DAILY_BRIEFING", "ANALYZE_TEAM"]: return "manager"
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