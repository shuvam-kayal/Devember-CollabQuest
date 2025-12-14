from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
from app.models import Team, User, Notification, Match
from app.auth.dependencies import get_current_user
from app.services.ai_roadmap import generate_roadmap, suggest_tech_stack
from pydantic import BaseModel

router = APIRouter()

# ... (Keep Input/Response Models same as before) ...
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
    members: List[MemberInfo]
    needed_skills: List[str]
    project_roadmap: Optional[dict] = None
    chat_group_id: Optional[str] = None

# ... (Keep create_team, get_all_teams, get_team_details) ...
@router.post("/", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    new_team = Team(
        name=team_data.name, description=team_data.description,
        members=[str(current_user.id)], needed_skills=team_data.needed_skills, project_roadmap={} 
    )
    await new_team.insert()
    return new_team

@router.get("/", response_model=List[Team])
async def get_all_teams():
    teams = await Team.find_all().to_list()
    return teams

@router.get("/{team_id}", response_model=TeamDetailResponse)
async def get_team_details(team_id: str):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, detail="Team not found")
    member_objects = []
    for uid in team.members:
        user = await User.get(uid)
        if user:
            member_objects.append({
                "id": str(user.id), "username": user.username,
                "avatar_url": user.avatar_url or "https://github.com/shadcn.png", "email": user.email
            })
    from app.models import ChatGroup
    chat_group = await ChatGroup.find_one(ChatGroup.team_id == str(team.id))
    return {
        "id": str(team.id), "name": team.name, "description": team.description,
        "leader_id": team.members[0], "members": member_objects,
        "needed_skills": team.needed_skills, "project_roadmap": team.project_roadmap,
        "chat_group_id": str(chat_group.id) if chat_group else None
    }

# ... (Keep send_invite and add_member) ...
@router.post("/{team_id}/invite")
async def send_invite(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, detail="Team not found")
    
    is_leader = str(current_user.id) == team.members[0]
    
    if is_leader:
        candidate_id = req.target_user_id
        leader_id = str(current_user.id)
        new_status = "invited"
        msg = f"Join my team '{team.name}'?"
        type = "team_invite"
    else:
        candidate_id = str(current_user.id)
        leader_id = team.members[0]
        req.target_user_id = leader_id 
        new_status = "requested"
        msg = f"{current_user.username} wants to join '{team.name}'."
        type = "join_request"

    match_record = await Match.find_one(Match.user_id == candidate_id, Match.project_id == team_id)
    if not match_record:
        match_record = Match(user_id=candidate_id, project_id=team_id, leader_id=leader_id, status=new_status)
        await match_record.insert()
    else:
        match_record.status = new_status
        match_record.last_action_at = datetime.now()
        await match_record.save()
    
    await Notification(
        recipient_id=req.target_user_id, sender_id=str(current_user.id),
        message=msg, type=type, related_id=team_id 
    ).insert()
    
    return {"status": "sent", "new_match_status": new_status}

@router.post("/{team_id}/members")
async def add_member(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    
    candidate_id = req.target_user_id
    leader_id = team.members[0]
    
    if candidate_id not in team.members:
        team.members.append(candidate_id)
        await team.save()
        
        await Notification(
            recipient_id=candidate_id, sender_id=leader_id,
            message=f"Welcome to {team.name}!", type="info"
        ).insert()

        candidate_user = await User.get(candidate_id)
        c_name = candidate_user.username if candidate_user else "A new member"
        
        if str(current_user.id) != leader_id:
             await Notification(
                recipient_id=leader_id, sender_id=candidate_id,
                message=f"{c_name} has joined your team {team.name}!", type="info"
            ).insert()

    match_record = await Match.find_one(Match.user_id == candidate_id, Match.project_id == team_id)
    if match_record:
        match_record.status = "joined"
        await match_record.save()
    else:
        await Match(user_id=candidate_id, project_id=team_id, leader_id=leader_id, status="joined").insert()

    return team

@router.post("/{team_id}/reject")
async def reject_invite(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    leader_id = team.members[0]
    is_leader = str(current_user.id) == leader_id
    if is_leader: candidate_id = req.target_user_id
    else: candidate_id = str(current_user.id)
    match_record = await Match.find_one(Match.user_id == candidate_id, Match.project_id == team_id)
    if match_record:
        match_record.status = "rejected"
        match_record.rejected_by = str(current_user.id) # <--- SAVING WHO REJECTED
        await match_record.save()
    if is_leader:
        await Notification(recipient_id=candidate_id, sender_id=leader_id, message=f"Your request to join {team.name} was declined.", type="info").insert()
    else:
        await Notification(recipient_id=leader_id, sender_id=str(current_user.id), message=f"{current_user.username} declined your invite to {team.name}.", type="info").insert()
    return {"status": "rejected"}

# ... (Keep remove_member, update_team_skills, suggest_stack, create_team_roadmap) ...
@router.delete("/{team_id}/members/{user_id}")
async def remove_member(team_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) != team.members[0]: raise HTTPException(403)
    if user_id == team.members[0]: raise HTTPException(400)

    if user_id in team.members:
        team.members.remove(user_id)
        await team.save()
        match_record = await Match.find_one(Match.user_id == user_id, Match.project_id == team_id)
        if match_record:
            match_record.status = "matched"
            await match_record.save()
    return team

@router.put("/{team_id}/skills", response_model=Team)
async def update_team_skills(team_id: str, data: SkillsUpdate, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    team.needed_skills = data.needed_skills
    await team.save()
    return team

@router.post("/suggest-stack")
async def get_stack_suggestions(request: SuggestionRequest, current_user: User = Depends(get_current_user)):
    suggestions = await suggest_tech_stack(request.description, request.current_skills)
    return suggestions

@router.post("/{team_id}/roadmap", response_model=Team)
async def create_team_roadmap(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    current_skills = team.needed_skills or ["Standard Web Stack"]
    ai_plan = await generate_roadmap(team.description, current_skills)
    if not ai_plan: raise HTTPException(500, detail="AI failed")
    team.project_roadmap = ai_plan
    await team.save()
    return team

@router.post("/{team_id}/reset")
async def reset_match(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    """
    Resets a match from 'rejected' back to 'matched' so actions can be taken again.
    """
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    
    # Determine who is the candidate
    leader_id = team.members[0]
    is_leader = str(current_user.id) == leader_id
    
    if is_leader: candidate_id = req.target_user_id
    else: candidate_id = str(current_user.id)
    
    match_record = await Match.find_one(Match.user_id == candidate_id, Match.project_id == team_id)
    
    if match_record:
        # Only allow reset if currently rejected or joined (to leave and rejoin)
        match_record.status = "matched"
        match_record.rejected_by = None # Clear rejection
        match_record.last_action_at = datetime.now()
        await match_record.save()
        
    return {"status": "reset"}