import os
import asyncio
import json
from openai import AsyncOpenAI
from dotenv import load_dotenv
from app.models import ChatMessage, Team, User
# --- CRITICAL IMPORT: The new Team Matcher ---
from app.services.recommendation_service import search_vectors

load_dotenv()

# 1. SETUP OPENROUTER CLIENT
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

# 2. DEFINE MODELS
MENTOR_MODEL = "meta-llama/llama-3.3-70b-instruct:free" 
CODER_MODEL = "xiaomi/mimo-v2-flash:free"     

async def create_ai_project(user_idea: str, user_id:str):
    """
    Uses AI to expand a vague idea into a full project structure
    and saves it to the database.
    """

    system_prompt = """
    You are an expert Technical Project Manager.
    
    Your Task: Convert the user's rough idea into a concrete Project Plan.
    
    CRITICAL LOGIC FOR TECH STACK:
    1. If the user specifies technologies (e.g., "using Rust"), you MUST use them.
    2. If the user DOES NOT specify technologies, you MUST INFER the best modern stack.
       - Example: "Make a game" -> You add ["Unity", "C#", "Blender"]
       - Example: "Make a data dashboard" -> You add ["Python", "Streamlit", "Pandas"]
    
    Output format must be strictly JSON (no markdown, no extra text):
    {
        "name": "A Creative & Catchy Project Title",
        "description": "A professional, exciting 2-sentence summary of what the project does.",
        "needed_skills": ["Tech1", "Tech2", "Framework", "Concept"],
        "roadmap": ["Phase 1: Setup & Design", "Phase 2: MVP Development", "Phase 3: Testing & Launch"]
    }
    """

    try:
        completion = await client.chat.completions.create(
            model=MENTOR_MODEL,
            messages=[
                {"role":"system", "content": system_prompt},
                {"role":"user", "content": f"Create a project for: {user_idea}"}
            ]
        )
        
        ai_response = completion.choices[0].message.content
        
        clean_json = ai_response.replace("```json", "").replace("```", "").strip()
        project_data = json.loads(clean_json)

        new_team = Team(
            name=project_data["name"],
            description=project_data["description"],
            leader_id=user_id,  # Assign the current user as Leader
            needed_skills=project_data["needed_skills"], # AI-generated skills
            members=[user_id],  # Add leader as first member
            roadmap=project_data.get("roadmap", []) 
        )
        await new_team.insert()
        
        return f"✅ Success! I've created the project **'{project_data['name']}'** for you.\n\n**Description:** {project_data['description']}\n**Tech Stack:** {', '.join(project_data['needed_skills'])}\n\nYou can view and edit it in the Dashboard!"

    except Exception as e:
        print(f"Project Creation Error: {e}")
        return "I tried to create the project, but I ran into a database error. Please try posting it manually on the Marketplace."

async def generate_chat_reply(question: str, user_skills: list[str], user_id: str) -> str:
    """
        The Master Router:
        Layer 0: ACTION - Create Project (Auto-generates Tech Stack)
        Layer 1: CODE - Xiaomi
        Layer 2: SEARCH - Vector DB
        Layer 3: TALK - Llama 3 Mentor
    """

    # --- LAYER 0: ACTION LAYER (CREATE PROJECT) ---
    # Trigger phrases: "create a project about", "post a project", "start a team"
    action_keywords = ["create a project", "post a project", "start a new project", "create a team", "make a project about", "build a project"]
    
    if any(k in question.lower() for k in action_keywords):
        print(f"🚀 Layer 0: Detected Project Creation Intent...")
        # Pass the whole question as the "Idea"
        return await create_ai_project(question, user_id)

    # --- LAYER 1: CODING SPECIALIST (Xiaomi) ---
    code_keywords = ["write code", "give code", "python script", "function to", "generate code", "html css", "code for", "fix this code", "api endpoint"]
    is_code_request = any(keyword in question.lower() for keyword in code_keywords)

    if is_code_request:
        print(f"🔧 Layer 1: Routing to Xiaomi (Coder): {question[:30]}...")
        try:
            completion = await client.chat.completions.create(
                model=CODER_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert coding assistant. Provide clean, working code. Do NOT use bold text asterisks in your explanations."},
                    {"role": "user", "content": question}
                ],
                extra_body={"include_reasoning": False}
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"⚠️ Xiaomi failed, falling back to Mentor: {e}")
            pass 

    # --- LAYER 2: RECOMMENDATION ENGINE (Team/User Matching) ---
    find_keywords = [
            # Direct requests
            "suggest a team", "suggest teams", "find a project", "find projects",
            "find me a team", "find me teams", "recommend a project", "recommend teams",
            
            # "Looking for..." variations
            "looking for a team", "looking for teams", "looking for project", 
            "looking for projects", "looking for developers", 
            
            # "Join" variations
            "join a team", "join teams", "want to join", "joining a team",
            
            # "Using" / Technology focused
            "teams using", "projects using", "team with", "project with",
            
            # Broad searches
            "show me teams", "show teams", "list teams", "search for teams",
            "who knows", "search for members", "need a team"
        ]
        
    # This check sees if ANY of the above phrases are in your question
    is_search_request = any(keyword in question.lower() for keyword in find_keywords)

    if is_search_request:
        print(f"🔍 Layer 2: Searching Vector DB for Matches...")
        try:
            search_type = "team" 
            if any(k in question.lower() for k in ["developer", "who", "member", "person", "user"]):
                search_type = "user"

            # Combine question + skills for better matching
            search_query = f"{question} {', '.join(user_skills)}"

            # Direct await (since search_vectors is async/wrapped)
            matches = await asyncio.to_thread(search_vectors, search_query, filter_type=search_type)
            
            if matches:
                context_text = "\n\n".join(matches)
                prompt = f"""
                The user asked: "{question}"
                
                Here are the REAL matches from our database:
                {context_text}
                
                INSTRUCTIONS:
                - Recommend ONLY the teams listed above.
                - Tell them exactly which project or person is the best fit and why.
                - Do NOT invent new team names.
                - If the projects above aren't a perfect fit, explain why, but stick to the data.
                - Do NOT use Markdown formatting (no asterisks).
                """
                
                completion = await client.chat.completions.create(
                    model=MENTOR_MODEL,
                    messages=[{"role": "user", "content": prompt}]
                )
                return completion.choices[0].message.content
            else:
                # 🔥 FIX 1: STOP HERE if no matches found. Prevent hallucination.
                print("   -> No matches found in DB. Returning honest response.")
                return "I searched our database, but I couldn't find any active teams matching your request right now. You can browse all open projects on the Marketplace page!"

        except Exception as e:
            print(f"⚠️ Matcher Error: {e}")


    # --- LAYER 3: KNOWLEDGE BASE ---
    # (Kept the full detailed manual as requested)
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
    You are CollabQuest Mentor Bot, the official AI assistant for this platform.

    User Context:
    User ID: {user_id}
    Current Skills: {", ".join(user_skills) if user_skills else "Beginner"}

    {platform_guide}

    INSTRUCTIONS:
    - If the user asks about the Platform, use the Manual above.
    - If the user asks for code (and the coding model failed), provide the code yourself.
    
    - **ANTI-HALLUCINATION RULE:** If the user asks for "Team Suggestions" or "Project Ideas" and you reached this point, it means NO database matches were found.
    - **DO NOT INVENT FAKE PROJECTS.** - Instead, politely tell the user: "I don't have any specific projects for you right now, but you can post your own idea on the Marketplace!"
    
    - **FORMATTING:** Do NOT use bold text, asterisks (**), or Markdown headers (#). Write in clean, plain text. Use standard numbering (1., 2.) for lists.
    - Be patient, encouraging, and thorough.
    """

    # --- BUILD HISTORY ---
    try:
        past_messages = await ChatMessage.find(
            ChatMessage.user_id == user_id
        ).sort("-timestamp").limit(6).to_list()
    except Exception:
        past_messages = []
    
    messages_payload = [
        {"role": "system", "content": system_instruction}
    ]

    # Add history (Reversed because DB gives newest first)
    for msg in reversed(past_messages):
        # Truncate to 200 chars to save context
        q_text = (msg.question[:200] + '..') if len(msg.question) > 200 else msg.question
        a_text = (msg.answer[:200] + '..') if len(msg.answer) > 200 else msg.answer
        
        messages_payload.append({"role": "user", "content": q_text})
        messages_payload.append({"role": "assistant", "content": a_text})

    # Add the current question
    messages_payload.append({"role": "user", "content": question})

    # --- CALL GEMINI/LLAMA ---
    try:
        print(f"🤖 Routing to Mentor (Llama 3): {question[:30]}...")
        completion = await client.chat.completions.create(
            model=MENTOR_MODEL,
            messages=messages_payload,
            extra_headers={
                "HTTP-Referer": "https://collabquest.com",
                "X-Title": "CollabQuest"
            }
        )
        return completion.choices[0].message.content

    except Exception as e:
        print(f"❌ AI Service Error: {e}")
        return "I'm having trouble connecting to the network right now. Please try again in a moment."