import os
import google.generativeai as genai
import json
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def generate_roadmap(project_idea: str, tech_stack: list[str]):
    """
    Generates a structured project roadmap using Gemini Pro.
    Returns a JSON object with phases and tasks.
    """
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # The Prompt Engineering (Crucial for good results)
    prompt = f"""
    You are a Senior Project Manager for a Hackathon.
    Create a 4-week project roadmap for a team building: "{project_idea}".
    Tech Stack: {', '.join(tech_stack)}.
    
    You MUST return ONLY a valid JSON object. Do not add markdown formatting like ```json.
    
    The JSON structure must be:
    {{
        "title": "Project Name",
        "phases": [
            {{
                "week": 1,
                "goal": "Core Setup",
                "tasks": [
                    {{"role": "Frontend", "task": "Task description"}},
                    {{"role": "Backend", "task": "Task description"}}
                ]
            }}
        ]
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        # Clean up response (sometimes AI adds markdown backticks)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        roadmap_json = json.loads(clean_text)
        return roadmap_json
    except Exception as e:
        print(f"AI Error: {e}")
        return None
    

async def suggest_tech_stack(description: str, current_stack: list[str]):
    """
    Reviews the current stack and suggests additions/removals.
    """
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    You are a CTO reviewing a project tech stack.
    Project: "{description}"
    Current Stack: {current_stack}
    
    1. Suggest NEW modern tools to ADD that are missing (e.g., Database, Auth, Deployment).
    2. Identify redundant/outdated tools to REMOVE if any(e.g., if "React" and "jQuery" both exist, remove jQuery).
    
    Return ONLY a valid JSON object. No markdown.
    Format:
    {{
        "add": ["Tool A", "Tool B"],
        "remove": ["Tool C"]
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"AI Suggestion Error: {e}")
        return {"add": [], "remove": []}
    

# --- NEW: INTEREST EXPANSION ---
async def expand_interests(interests: list[str]):
    """
    Takes raw interests (e.g. ['crypto']) and returns expanded synonyms 
    (e.g. ['crypto', 'blockchain', 'web3', 'finance']).
    This allows matching even if users use different words.
    """
    if not interests: return []
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"""
    You are a Matching Algorithm.
    Input Interests: {interests}
    
    Task: Normalize these tags and add 2-3 relevant synonyms/categories for each to improve matching. 
    Fix typos. Return a flat list of strings.
    
    Example Input: ["ML", "reactjs"]
    Example Output: ["machine learning", "ai", "data science", "react", "frontend", "javascript"]
    
    Return ONLY valid JSON array of strings. Lowercase.
    """
    try:
        response = model.generate_content(prompt)
        clean = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception as e:
        print(f"AI Expansion Failed: {e}")
        return interests # Fallback to original