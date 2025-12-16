from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from app.models import Team, User, Notification, Match, ChatGroup, DeletionRequest, CompletionRequest, Swipe, Task
from app.auth.dependencies import get_current_user
from app.services.ai_roadmap import generate_roadmap, suggest_tech_stack
from app.routes.chat_routes import manager 
from pydantic import BaseModel
import math
from app.auth.utils import verify_token # Helper to decode manually if needed
import uuid # <--- ADD THIS

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

class VoteRequest(BaseModel):
    decision: str 

class RatingRequest(BaseModel):
    target_user_id: str
    score: int 

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
    completion_request: Optional[CompletionRequest] = None
    status: str = "active"
    has_liked: bool = False # <--- NEW FIELD

# --- UPDATED TASK INPUT ---
class CreateTaskRequest(BaseModel):
    description: str
    assignee_id: str
    deadline: str # FIX: Accept string from frontend to avoid validation error

class TaskDetailResponse(BaseModel):
    id: str
    description: str
    assignee_id: str
    assignee_name: str
    assignee_avatar: str | None
    deadline: datetime
    status: str
    verification_votes: int
    required_votes: int
    is_overdue: bool # Calculated field

async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    if not authorization: return None
    try:
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        return await User.get(payload.get("sub"))
    except:
        return None

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
async def get_team_details(team_id: str, current_user: Optional[User] = Depends(get_optional_user)):
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
    
    # Check if user has liked this project recently
    has_liked = False
    if current_user:
        last_swipe = await Swipe.find(
            Swipe.swiper_id == str(current_user.id),
            Swipe.target_id == str(team.id),
            Swipe.direction == "right"
        ).sort("-timestamp").first_or_none()
        
        if last_swipe:
            if (datetime.now() - last_swipe.timestamp) < timedelta(days=3):
                has_liked = True

    return {
        "id": str(team.id), "name": team.name, "description": team.description,
        "leader_id": team.members[0], "members": member_objects,
        "needed_skills": team.needed_skills, "project_roadmap": team.project_roadmap,
        "chat_group_id": str(chat_group.id) if chat_group else None,
        "target_members": team.target_members,
        "target_completion_date": team.target_completion_date,
        "deletion_request": team.deletion_request,
        "completion_request": team.completion_request,
        "status": team.status,
        "has_liked": has_liked # <--- Returned
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

# ... (Delete/Vote/Complete Routes - KEEP EXISTING LOGIC) ...
@router.post("/{team_id}/delete/initiate")
async def initiate_deletion(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) != team.members[0]: raise HTTPException(403)
    
    if len(team.members) == 1:
        await team.delete()
        await ChatGroup.find(ChatGroup.team_id == team_id).delete()
        await Match.find(Match.project_id == team_id).delete()
        return {"status": "deleted"}

    req = DeletionRequest(is_active=True, initiator_id=str(current_user.id), votes={})
    team.deletion_request = req
    await team.save()
    
    for member_id in team.members:
        notif = Notification(recipient_id=member_id, sender_id=str(current_user.id), message=f"Vote to DELETE project '{team.name}'.", type="deletion_request", related_id=team_id)
        await notif.insert()
        await manager.send_personal_message({"event": "notification", "notification": {"_id": str(notif.id), "message": notif.message, "type": notif.type, "is_read": False, "related_id": team_id, "sender_id": notif.sender_id}}, member_id)
    return {"status": "initiated"}

@router.post("/{team_id}/delete/vote")
async def vote_deletion(team_id: str, vote: VoteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if not team.deletion_request or not team.deletion_request.is_active: raise HTTPException(400)
    
    if (datetime.now() - team.deletion_request.created_at) > timedelta(days=2):
        team.deletion_request = None
        await team.save()
        return {"status": "expired"}

    uid = str(current_user.id)
    team.deletion_request.votes[uid] = vote.decision
    await team.save()
    
    await Notification.find(Notification.recipient_id == uid, Notification.type == "deletion_request", Notification.related_id == team_id).update({"$set": {"action_status": "voted", "is_read": True}})

    total = len(team.members)
    votes_cast = len(team.deletion_request.votes)
    approvals = sum(1 for v in team.deletion_request.votes.values() if v == "approve")
    
    if approvals >= math.ceil(total * 0.7):
        await team.delete()
        await ChatGroup.find(ChatGroup.team_id == team_id).delete()
        await Match.find(Match.project_id == team_id).delete()
        for m_id in team.members:
            await manager.send_personal_message({"event": "team_deleted", "message": f"Project '{team.name}' deleted."}, m_id)
        return {"status": "deleted"}
    
    if votes_cast == total:
        team.deletion_request = None
        await team.save()
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Vote failed. Project '{team.name}' kept.", type="info").insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
        return {"status": "kept"}
        
    return {"status": "voted"}

@router.post("/{team_id}/complete/initiate")
async def initiate_completion(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) != team.members[0]: raise HTTPException(403)
    
    if len(team.members) == 1:
        team.status = "completed"
        await team.save()
        return {"status": "completed"}

    req = CompletionRequest(is_active=True, initiator_id=str(current_user.id), votes={})
    team.completion_request = req
    await team.save()
    
    for member_id in team.members:
        notif = Notification(recipient_id=member_id, sender_id=str(current_user.id), message=f"Vote to mark project '{team.name}' as COMPLETED.", type="completion_request", related_id=team_id)
        await notif.insert()
        await manager.send_personal_message({"event": "notification", "notification": {"_id": str(notif.id), "message": notif.message, "type": notif.type, "is_read": False, "related_id": team_id, "sender_id": notif.sender_id}}, member_id)
    return {"status": "initiated"}

@router.post("/{team_id}/complete/vote")
async def vote_completion(team_id: str, vote: VoteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if not team.completion_request or not team.completion_request.is_active: raise HTTPException(400)
    
    uid = str(current_user.id)
    team.completion_request.votes[uid] = vote.decision
    await team.save()
    
    await Notification.find(Notification.recipient_id == uid, Notification.type == "completion_request", Notification.related_id == team_id).update({"$set": {"action_status": "voted", "is_read": True}})

    total = len(team.members)
    votes_cast = len(team.completion_request.votes)
    approvals = sum(1 for v in team.completion_request.votes.values() if v == "approve")
    
    if approvals >= math.ceil(total * 0.7):
        team.status = "completed"
        team.completion_request = None 
        await team.save()
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Project '{team.name}' completed! Rate your team now.", type="info", related_id=team_id).insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
        return {"status": "completed"}
    
    if votes_cast == total:
        team.completion_request = None
        await team.save()
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Completion vote failed for '{team.name}'.", type="info").insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
        return {"status": "kept"}
        
    return {"status": "voted"}

@router.post("/{team_id}/rate")
async def rate_teammate(team_id: str, req: RatingRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) not in team.members or req.target_user_id not in team.members: raise HTTPException(403)
    
    target = await User.get(req.target_user_id)
    if target:
        current_score = target.trust_score
        count = target.rating_count
        new_score = ((current_score * count) + req.score) / (count + 1)
        target.trust_score = round(new_score, 1)
        target.rating_count += 1
        await target.save()
    return {"status": "rated"}

# ... (AI Roadmap, Invite, Members, Reject, Remove, Skills, Reset - Keep exactly as before) ...
@router.post("/{team_id}/roadmap", response_model=Team)
async def create_team_roadmap(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    weeks = 4
    if team.target_completion_date:
        delta = team.target_completion_date - datetime.now(team.target_completion_date.tzinfo)
        weeks = max(1, round(delta.days / 7))
    current_skills = team.needed_skills or ["Standard Web Stack"]
    ai_plan = await generate_roadmap(team.description, current_skills, weeks=weeks)
    if not ai_plan: raise HTTPException(500, detail="AI failed")
    team.project_roadmap = ai_plan
    await team.save()
    return team

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
        
        # Clean up votes if new member joins? Usually votes are reset or they just join active vote
        # For simplicity, we don't reset votes, they just increase the denominator
        
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
        # Fix vote skew
        if team.deletion_request and user_id in team.deletion_request.votes:
            del team.deletion_request.votes[user_id]
        if team.completion_request and user_id in team.completion_request.votes:
            del team.completion_request.votes[user_id]
            
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

@router.post("/{team_id}/tasks")
async def create_task(team_id: str, req: CreateTaskRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) != team.members[0]: raise HTTPException(403, "Only Leader can assign tasks")
    
    # FIX: Parse string manually to ensure compatibility
    try:
        dt = datetime.fromisoformat(req.deadline)
    except ValueError:
        # Fallback if frontend sends simple date or different format
        dt = datetime.now() + timedelta(days=1) 

    new_task = Task(
        id=str(uuid.uuid4()),
        description=req.description,
        assignee_id=req.assignee_id,
        deadline=dt 
    )
    
    team.tasks.append(new_task)
    await team.save()
    
    if req.assignee_id != str(current_user.id):
        await Notification(
            recipient_id=req.assignee_id, sender_id=str(current_user.id),
            message=f"New task assigned: {req.description}", type="info", related_id=team_id
        ).insert()
        await manager.send_personal_message({"event": "dashboardUpdate"}, req.assignee_id)
        
    return {"status": "created"}

@router.delete("/{team_id}/tasks/{task_id}")
async def delete_task(team_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) != team.members[0]: raise HTTPException(403, "Only Leader can delete tasks")
    
    # Filter out the task
    initial_len = len(team.tasks)
    team.tasks = [t for t in team.tasks if t.id != task_id]
    
    if len(team.tasks) == initial_len:
        raise HTTPException(404, "Task not found")
        
    await team.save()
    return {"status": "deleted"}

@router.post("/{team_id}/tasks/{task_id}/submit")
async def submit_task(team_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    task = next((t for t in team.tasks if t.id == task_id), None)
    if not task: raise HTTPException(404)
    if str(current_user.id) != task.assignee_id: raise HTTPException(403)
    
    task.status = "review"
    task.verification_votes = [] # Reset votes on new submission
    task.rework_votes = []       # Reset rework votes
    await team.save()
    
    # Notify team
    for m_id in team.members:
        if m_id != str(current_user.id):
            await Notification(recipient_id=m_id, sender_id=str(current_user.id), message=f"Review needed: {task.description}", type="info", related_id=team_id).insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
    return {"status": "submitted"}

@router.post("/{team_id}/tasks/{task_id}/verify")
async def verify_task(team_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    task = next((t for t in team.tasks if t.id == task_id), None)
    if not task or task.status != "review": raise HTTPException(400, "Invalid task")
    
    uid = str(current_user.id)
    if uid == task.assignee_id: raise HTTPException(403, "Self-verification not allowed")
    if uid in task.verification_votes or uid in task.rework_votes: raise HTTPException(400, "Already voted")
    
    task.verification_votes.append(uid)
    
    # Logic: 20% of Team (min 1 person if team > 1)
    total_reviewers = len(team.members) # or len(team.members) - 1 to exclude assignee
    required = math.ceil(total_reviewers * 0.2)
    
    if len(task.verification_votes) >= required:
        task.status = "completed"
        task.completed_at = datetime.now()
        await Notification(recipient_id=task.assignee_id, sender_id=uid, message=f"Task '{task.description}' Verified!", type="info", related_id=team_id).insert()
    
    await team.save()
    return {"status": "voted"}

@router.post("/{team_id}/tasks/{task_id}/rework")
async def request_rework(team_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    task = next((t for t in team.tasks if t.id == task_id), None)
    if not task or task.status != "review": raise HTTPException(400, "Invalid task")
    
    uid = str(current_user.id)
    if uid == task.assignee_id: raise HTTPException(403)
    if uid in task.verification_votes or uid in task.rework_votes: raise HTTPException(400, "Already voted")
    
    task.rework_votes.append(uid)
    
    # Logic: 30% request rework
    total_reviewers = len(team.members)
    required = math.ceil(total_reviewers * 0.3)
    
    if len(task.rework_votes) >= required:
        task.status = "rework" # Send back
        await Notification(recipient_id=task.assignee_id, sender_id=uid, message=f"Rework requested for '{task.description}'", type="info", related_id=team_id).insert()
    
    await team.save()
    return {"status": "voted"}

@router.get("/{team_id}/tasks", response_model=List[TaskDetailResponse])
async def get_team_tasks(team_id: str):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    
    results = []
    now = datetime.now()
    
    for t in team.tasks:
        assignee = await User.get(t.assignee_id)
        
        # 1-Day Notification Trigger (Lazy Check)
        time_left = t.deadline - now
        if t.status in ["pending", "rework"] and timedelta(hours=0) < time_left < timedelta(hours=24):
            # Check if we already notified recently? (Simplification: Just check logic, in prod use separate job)
            # Ideally we'd store 'last_reminded' on task. For now, we assume user checks dashboard.
            pass 

        is_overdue = False
        if t.status == "completed" and t.completed_at:
            if t.completed_at > t.deadline: is_overdue = True
        elif t.status != "completed":
            if now > t.deadline: is_overdue = True
            
        results.append({
            "id": t.id,
            "description": t.description,
            "assignee_id": t.assignee_id,
            "assignee_name": assignee.username if assignee else "Unknown",
            "assignee_avatar": assignee.avatar_url,
            "deadline": t.deadline,
            "status": t.status,
            "verification_votes": len(t.verification_votes),
            "required_votes": math.ceil(len(team.members) * 0.2),
            "rework_votes": len(t.rework_votes),
            "required_rework": math.ceil(len(team.members) * 0.3),
            "is_overdue": is_overdue
        })
    
    results.sort(key=lambda x: (x["status"] == "completed", not x["is_overdue"], x["deadline"]))
    return results