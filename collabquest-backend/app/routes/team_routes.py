from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from app.models import Team, User, Notification, Match, ChatGroup, DeletionRequest
from app.auth.dependencies import get_current_user
from app.services.ai_roadmap import generate_roadmap, suggest_tech_stack
from app.routes.chat_routes import manager 
from pydantic import BaseModel
import math

router = APIRouter()

# --- INPUT MODELS ---
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

# --- ADDED THIS MISSING MODEL ---
class VoteRequest(BaseModel):
    decision: str # "approve" or "reject"

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
    target_members: int = 4
    target_completion_date: Optional[datetime] = None
    deletion_request: Optional[DeletionRequest] = None

# --- ROUTES ---

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
        "chat_group_id": str(chat_group.id) if chat_group else None,
        "target_members": team.target_members,
        "target_completion_date": team.target_completion_date,
        "deletion_request": team.deletion_request
    }

@router.put("/{team_id}")
async def update_team_details(team_id: str, data: dict, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) != team.members[0]: raise HTTPException(403, "Only Leader can edit")

    if "name" in data: team.name = data["name"]
    if "description" in data: team.description = data["description"]
    if "target_members" in data: team.target_members = data["target_members"]
    if "target_completion_date" in data: 
        if data["target_completion_date"]:
            team.target_completion_date = datetime.fromisoformat(data["target_completion_date"].replace('Z', '+00:00'))
        else:
            team.target_completion_date = None
    
    await team.save()
    return team

# --- DELETE VOTE ROUTES ---
@router.post("/{team_id}/delete/initiate")
async def initiate_deletion(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) != team.members[0]: raise HTTPException(403, "Only leader can initiate")
    
    # CASE 1: Single Member (Delete Immediately)
    if len(team.members) == 1:
        await team.delete()
        await ChatGroup.find(ChatGroup.team_id == team_id).delete()
        await Match.find(Match.project_id == team_id).delete()
        return {"status": "deleted"}

    # CASE 2: Initiate Vote
    req = DeletionRequest(
        is_active=True, 
        initiator_id=str(current_user.id),
        votes={} # Leader must explicitly vote later
    )
    team.deletion_request = req
    await team.save()
    
    # Notify all members (including leader self-notification via Header logic if desired, or skip)
    for member_id in team.members:
        notif = Notification(
            recipient_id=member_id, sender_id=str(current_user.id),
            message=f"Leader initiated a vote to DELETE project '{team.name}'.",
            type="deletion_request", related_id=team_id
        )
        await notif.insert()
        await manager.send_personal_message({
            "event": "notification",
            "notification": {
                "_id": str(notif.id), "message": notif.message, "type": notif.type,
                "is_read": False, "related_id": team_id, "sender_id": notif.sender_id
            }
        }, member_id)
            
    return {"status": "initiated", "votes": req.votes}

@router.post("/{team_id}/delete/vote")
async def vote_deletion(team_id: str, vote: VoteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if not team.deletion_request or not team.deletion_request.is_active:
        raise HTTPException(400, "No active deletion request")
    
    # Check 2-day Expiry
    if (datetime.now() - team.deletion_request.created_at) > timedelta(days=2):
        team.deletion_request = None # Expired, reset
        await team.save()
        return {"status": "expired"}

    uid = str(current_user.id)
    if uid not in team.members: raise HTTPException(403)
    
    # Record Vote
    team.deletion_request.votes[uid] = vote.decision
    await team.save()
    
    # Sync Notification for Voter
    await Notification.find(
        Notification.recipient_id == uid,
        Notification.type == "deletion_request",
        Notification.related_id == team_id
    ).update({"$set": {"action_status": "voted", "is_read": True}})

    # Calculate Consensus
    total_members = len(team.members)
    votes_cast = len(team.deletion_request.votes)
    approvals = sum(1 for v in team.deletion_request.votes.values() if v == "approve")
    threshold = math.ceil(total_members * 0.7)
    
    # 1. Success Condition
    if approvals >= threshold:
        await team.delete()
        await ChatGroup.find(ChatGroup.team_id == team_id).delete()
        await Match.find(Match.project_id == team_id).delete()
        
        for m_id in team.members:
            msg = f"Project '{team.name}' has been deleted by consensus."
            await Notification(recipient_id=m_id, sender_id=uid, message=msg, type="info").insert()
            await manager.send_personal_message({"event": "team_deleted", "team_id": team_id, "message": msg}, m_id)
            
        return {"status": "deleted"}
    
    # 2. Failure Condition (Everyone voted but threshold not met)
    if votes_cast == total_members:
        team.deletion_request = None # Reset
        await team.save()
        # Notify failure? Optional.
        return {"status": "kept", "message": "Consensus not reached"}
        
    return {"status": "voted"}

# ... (Existing methods: send_invite, add_member, reject_invite, remove_member, update_team_skills, etc. - keep unchanged) ...
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
    
    notif = Notification(recipient_id=req.target_user_id, sender_id=str(current_user.id), message=msg, type=type, related_id=team_id)
    await notif.insert()
    await manager.send_personal_message({"event": "notification", "notification": {"_id": str(notif.id), "message": msg, "type": type, "is_read": False, "related_id": team_id, "sender_id": str(current_user.id)}}, req.target_user_id)
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
        if str(current_user.id) == leader_id:
            await Notification.find(Notification.recipient_id == leader_id, Notification.sender_id == candidate_id, Notification.type == "join_request", Notification.related_id == team_id).update({"$set": {"action_status": "accepted", "is_read": True}})
        else:
            await Notification.find(Notification.recipient_id == candidate_id, Notification.type == "team_invite", Notification.related_id == team_id).update({"$set": {"action_status": "accepted", "is_read": True}})
        candidate_user = await User.get(candidate_id)
        c_name = candidate_user.username if candidate_user else "A new member"
        await Notification(recipient_id=candidate_id, sender_id=leader_id, message=f"Welcome to {team.name}!", type="info").insert()
        if str(current_user.id) != leader_id:
             await Notification(recipient_id=leader_id, sender_id=candidate_id, message=f"{c_name} has joined your team {team.name}!", type="info").insert()
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
        match_record.rejected_by = str(current_user.id)
        await match_record.save()
    if is_leader:
         await Notification.find(Notification.recipient_id == leader_id, Notification.sender_id == candidate_id, Notification.type == "join_request", Notification.related_id == team_id).update({"$set": {"action_status": "rejected", "is_read": True}})
         n = Notification(recipient_id=candidate_id, sender_id=leader_id, message=f"Your request to join {team.name} was declined.", type="info")
         await n.insert()
         await manager.send_personal_message({"event": "notification", "notification": {"_id": str(n.id), "message": n.message, "type": "info", "is_read": False}}, candidate_id)
    else:
        await Notification.find(Notification.recipient_id == candidate_id, Notification.type == "team_invite", Notification.related_id == team_id).update({"$set": {"action_status": "rejected", "is_read": True}})
        n = Notification(recipient_id=leader_id, sender_id=str(current_user.id), message=f"{current_user.username} declined your invite to {team.name}.", type="info")
        await n.insert()
        await manager.send_personal_message({"event": "notification", "notification": {"_id": str(n.id), "message": n.message, "type": "info", "is_read": False}}, leader_id)
    return {"status": "rejected"}

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
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    leader_id = team.members[0]
    is_leader = str(current_user.id) == leader_id
    if is_leader: candidate_id = req.target_user_id
    else: candidate_id = str(current_user.id)
    match_record = await Match.find_one(Match.user_id == candidate_id, Match.project_id == team_id)
    if match_record:
        match_record.status = "matched"
        match_record.rejected_by = None 
        match_record.last_action_at = datetime.now()
        await match_record.save()
    return {"status": "reset"}