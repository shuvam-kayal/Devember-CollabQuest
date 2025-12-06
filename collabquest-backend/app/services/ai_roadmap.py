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