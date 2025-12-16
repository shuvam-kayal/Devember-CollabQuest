import os
import google.generativeai as genai
import json
import re
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Use your preferred model. If 2.5 fails, try 'gemini-2.0-flash-exp' or 'gemini-1.5-flash'
MODEL_NAME = 'gemini-2.5-flash' 

def clean_json_response(text):
    """
    Robustly extracts JSON from AI response, handling markdown and extra text.
    """
    try:
        # 1. Try finding JSON within code blocks
        match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        
        # 2. Try finding the first '{' and last '}'
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != -1:
            return json.loads(text[start:end])
            
        # 3. Try parsing raw text
        return json.loads(text)
    except Exception as e:
        print(f"JSON Parse Error: {e} | Text: {text}")
        return None

async def generate_roadmap(project_idea: str, tech_stack: list[str], weeks: int = 4):
    model = genai.GenerativeModel(MODEL_NAME)
    
    prompt = f"""
    You are a Senior Project Manager.
    Create a {weeks}-week project roadmap for a team building: "{project_idea}".
    Tech Stack: {', '.join(tech_stack)}.
    
    You MUST return ONLY a valid JSON object.
    Structure:
    {{
        "title": "Project Name",
        "phases": [
            {{ "week": 1, "goal": "Goal", "tasks": [{{"role": "Frontend", "task": "..."}}] }}
        ]
    }}
    """
    try:
        response = model.generate_content(prompt)
        return clean_json_response(response.text)
    except Exception as e:
        print(f"Roadmap AI Error: {e}")
        return None

async def suggest_tech_stack(description: str, current_stack: list[str]):
    """
    Reviews the current stack and suggests additions/removals.
    """
    model = genai.GenerativeModel(MODEL_NAME)
    
    prompt = f"""
    You are a CTO reviewing a project tech stack.
    Project Description: "{description}"
    Current Stack: {json.dumps(current_stack)}
    
    1. Suggest tools to ADD that are missing (e.g., Database, Auth, Deployment) relevant to the description.
    2. Identify redundant/outdated tools to REMOVE, only if they are too redundant.
    
    Return ONLY a valid JSON object. No markdown.
    Format:
    {{
        "add": ["Tool A", "Tool B"],
        "remove": ["Tool C"]
    }}
    """
    
    try:
        # Disable safety settings to prevent blocking legitimate tech terms
        response = model.generate_content(prompt, safety_settings={
            'HATE': 'BLOCK_NONE',
            'HARASSMENT': 'BLOCK_NONE',
            'SEXUAL': 'BLOCK_NONE',
            'DANGEROUS': 'BLOCK_NONE'
        })
        
        result = clean_json_response(response.text)
        if not result:
            return {"add": [], "remove": []}
            
        # Ensure keys exist
        return {
            "add": result.get("add", []),
            "remove": result.get("remove", [])
        }
    except Exception as e:
        print(f"Tech Stack AI Error: {e}")
        return {"add": [], "remove": []}

async def expand_interests(interests: list[str]):
    if not interests: return []
    model = genai.GenerativeModel('gemini-2.5-flash') # Keep 1.5 for simple tasks if 2.0 is heavy
    
    prompt = f"""
    Normalize these tags and add 2-3 synonyms.
    Input: {json.dumps(interests)}
    Return ONLY valid JSON array of strings.
    """
    try:
        response = model.generate_content(prompt)
        return clean_json_response(response.text) or interests
    except Exception as e:
        return interests