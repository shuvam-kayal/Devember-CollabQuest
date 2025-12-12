from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models import Team, User, Notification
from app.auth.dependencies import get_current_user
from app.services.ai_roadmap import generate_roadmap, suggest_tech_stack
from pydantic import BaseModel

router = APIRouter()

# --- Input Models ---
class TeamCreate(BaseModel):
    name: str
    description: str
    needed_skills: List[str]

class SkillsUpdate(BaseModel):
    needed_skills: List[str]

class RoadmapRequest(BaseModel):
    project_idea: str
    tech_stack: List[str]

class SuggestionRequest(BaseModel):
    description: str
    current_skills: List[str]

class InviteRequest(BaseModel):
    target_user_id: str

# --- Response Models ---
class MemberInfo(BaseModel):
    id: str
    username: str
    avatar_url: str | None
    email: str

class TeamDetailResponse(BaseModel):
    id: str
    name: str
    description: str
    leader_id: str
    members: List[MemberInfo] # Enriched member data
    needed_skills: List[str]
    project_roadmap: Optional[dict] = None

# --- Routes ---

@router.post("/", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    new_team = Team(
        name=team_data.name,
        description=team_data.description,
        members=[str(current_user.id)],
        needed_skills=team_data.needed_skills,
        project_roadmap={} 
    )
    await new_team.insert()
    return new_team

@router.get("/", response_model=List[Team])
async def get_all_teams():
    teams = await Team.find_all().to_list()
    return teams

# --- NEW: Get Single Team with Member Details ---
@router.get("/{team_id}", response_model=TeamDetailResponse)
async def get_team_details(team_id: str):
    team = await Team.get(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Populate Member Objects
    member_objects = []
    for uid in team.members:
        user = await User.get(uid)
        if user:
            member_objects.append({
                "id": str(user.id),
                "username": user.username,
                "avatar_url": user.avatar_url or "https://github.com/shadcn.png",
                "email": user.email
            })
            
    return {
        "id": str(team.id),
        "name": team.name,
        "description": team.description,
        "leader_id": team.members[0], # First member is leader
        "members": member_objects,
        "needed_skills": team.needed_skills,
        "project_roadmap": team.project_roadmap
    }

# --- NEW: Invite/Request Logic ---
@router.post("/{team_id}/invite")
async def send_invite(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, detail="Team not found")
    
    is_leader = str(current_user.id) == team.members[0]
    
    if is_leader:
        # Leader inviting User
        msg = f"Join my team '{team.name}'?"
        type = "team_invite" # Button: Accept
    else:
        # User requesting to join
        msg = f"{current_user.username} wants to join '{team.name}'."
        type = "join_request" # Button: Approve
        req.target_user_id = team.members[0] # Target is the Leader

    await Notification(
        recipient_id=req.target_user_id,
        sender_id=str(current_user.id),
        message=msg,
        type=type,
        related_id=team_id 
    ).insert()
    
    return {"status": "sent"}

# --- NEW: Add Member (Accept Invite) ---
@router.post("/{team_id}/members")
async def add_member(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    """
    Called when a user accepts an invite OR leader approves a request.
    req.target_user_id is the person JOINING.
    """
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    
    # Add to list if not already there
    if req.target_user_id not in team.members:
        team.members.append(req.target_user_id)
        await team.save()
        
        # Notify the new member
        await Notification(
            recipient_id=req.target_user_id,
            sender_id=str(current_user.id),
            message=f"Welcome to {team.name}!",
            type="info"
        ).insert()

    return team

# --- NEW: Remove Member ---
@router.delete("/{team_id}/members/{user_id}")
async def remove_member(team_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    
    # Only Leader can remove, and Leader cannot remove themselves
    if str(current_user.id) != team.members[0]:
        raise HTTPException(403, detail="Only the leader can remove members")
        
    if user_id == team.members[0]:
        raise HTTPException(400, detail="Leader cannot leave. Delete project instead.")

    if user_id in team.members:
        team.members.remove(user_id)
        await team.save()
        
    return team

# --- NEW: Update Project Skills ---
@router.put("/{team_id}/skills", response_model=Team)
async def update_team_skills(team_id: str, data: SkillsUpdate, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    if str(current_user.id) not in team.members:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    team.needed_skills = data.needed_skills
    await team.save()
    return team

# --- NEW: Ask AI for Stack ---
@router.post("/suggest-stack")
async def get_stack_suggestions(request: SuggestionRequest, current_user: User = Depends(get_current_user)):
    """
    Returns lists of skills to Add and Remove.
    """
    suggestions = await suggest_tech_stack(request.description, request.current_skills)
    return suggestions

# --- UPDATED: Generate Roadmap (Uses DB Skills) ---
@router.post("/{team_id}/roadmap", response_model=Team)
async def create_team_roadmap(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # 1. Fetch skills directly from the Team object in DB
    current_skills = team.needed_skills
    
    if not current_skills:
        # Fallback if empty
        current_skills = ["Standard Web Stack"]

    print(f"🤖 AI Generating roadmap for: {team.name} using {current_skills}...")
    
    ai_plan = await generate_roadmap(team.description, current_skills)
    
    if not ai_plan:
        raise HTTPException(status_code=500, detail="AI failed to generate roadmap")
    
    team.project_roadmap = ai_plan
    await team.save()
    
    return team