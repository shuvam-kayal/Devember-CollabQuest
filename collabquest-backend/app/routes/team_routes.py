from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models import Team, User
from app.auth.dependencies import get_current_user
from app.services.ai_roadmap import generate_roadmap # <--- New Import
from pydantic import BaseModel

router = APIRouter()

# --- INPUT MODELS ---
class TeamCreate(BaseModel):
    name: str
    description: str
    needed_skills: List[str]

class RoadmapRequest(BaseModel):
    project_idea: str
    tech_stack: List[str]

# --- ROUTES ---

@router.post("/", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    """
    User creates a new project idea.
    """
    new_team = Team(
        name=team_data.name,
        description=team_data.description,
        members=[str(current_user.id)],
        project_roadmap={} # Empty for now
    )
    await new_team.insert()
    return new_team

@router.get("/", response_model=List[Team])
async def get_all_teams():
    """
    Fetch all open projects for the Marketplace.
    """
    teams = await Team.find_all().to_list()
    return teams

@router.post("/{team_id}/roadmap", response_model=Team)
async def create_team_roadmap(team_id: str, request: RoadmapRequest, current_user: User = Depends(get_current_user)):
    """
    ✨ The Magic Button: AI Generates a Roadmap ✨
    1. Finds the team.
    2. Sends idea + stack to Gemini AI.
    3. Saves the resulting JSON Roadmap to MongoDB.
    """
    # 1. Find the Team
    team = await Team.get(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    # Check if user is actually a member (Security)
    if str(current_user.id) not in team.members:
        raise HTTPException(status_code=403, detail="You are not a member of this team")

    # 2. Call the AI Service
    print(f"🤖 AI Generating roadmap for: {request.project_idea}...")
    ai_plan = await generate_roadmap(request.project_idea, request.tech_stack)
    
    if not ai_plan:
        raise HTTPException(status_code=500, detail="AI failed to generate roadmap")
    
    # 3. Save to Database
    team.project_roadmap = ai_plan
    await team.save()
    
    return team