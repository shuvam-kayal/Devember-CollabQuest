from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional
from datetime import datetime, timedelta
from app.models import Team, User, Notification, Match, ChatGroup, DeletionRequest, CompletionRequest, Swipe, Task, MemberRequest, Rating, RatingBreakdown, ExtensionRequest, Announcement
from app.auth.dependencies import get_current_user
from app.services.ai_roadmap import generate_roadmap, suggest_tech_stack
from app.routes.chat_routes import manager 
from app.services.vector_store import generate_embedding
from pydantic import BaseModel
import math
from app.auth.utils import verify_token 
import uuid 
from bson import ObjectId

router = APIRouter()

# --- INPUT MODELS ---
class TeamCreate(BaseModel):
    name: str
    description: str
    needed_skills: List[str] 
    active_needed_skills: List[str] = []

class SkillsUpdate(BaseModel):
    needed_skills: List[str]

class AnnouncementRequest(BaseModel):
    content: str

class AnnouncementUpdate(BaseModel):
    content: str

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_members: Optional[int] = None
    target_completion_date: Optional[str] = None
    is_looking_for_members: Optional[bool] = None 
    active_needed_skills: Optional[List[str]] = None
    status: Optional[str] = None

class ActionWithExplanation(BaseModel):
    explanation: str

class VoteRequest(BaseModel):
    decision: str 

class SuggestionRequest(BaseModel):
    description: str
    current_skills: List[str]

class InviteRequest(BaseModel):
    target_user_id: str

class RatingRequest(BaseModel):
    target_user_id: str
    breakdown: dict
    explanation: Optional[str] = None 

class CreateTaskRequest(BaseModel):
    description: str
    assignee_id: str
    deadline: str

class ExtensionRequestInput(BaseModel):
    new_deadline: str

class TransferRequest(BaseModel):
    new_leader_id: str

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
    active_needed_skills: List[str]
    project_roadmap: Optional[dict] = None
    chat_group_id: Optional[str] = None
    target_members: int
    target_completion_date: Optional[datetime] = None
    deletion_request: Optional[DeletionRequest] = None
    completion_request: Optional[CompletionRequest] = None
    member_requests: List[MemberRequest] = [] 
    announcements: List[Announcement] = []
    status: str
    has_liked: bool
    is_looking_for_members: bool
    rated_member_ids: List[str] = []

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
    rework_votes: int
    required_rework: int
    is_overdue: bool 
    extension_active: bool = False
    extension_requested_date: Optional[datetime] = None 
    extension_votes: int = 0
    extension_required: int = 0
    was_extended: bool = False

async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    if not authorization: return None
    try:
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        return await User.get(payload.get("sub"))
    except: return None

def check_vote_expiration(team: Team):
    now = datetime.now()
    dirty = False
    
    # Check Member Requests
    for req in team.member_requests:
        if req.is_active and (now - req.created_at) > timedelta(days=2):
            req.is_active = False
            # Find related announcement and update
            for ann in team.announcements:
                if ann.vote_related_id == req.id:
                    ann.is_vote_active = False
                    ann.content += "\n\n⏰ **VOTE EXPIRED** (Time limit reached)"
            dirty = True

    # Check Deletion (Example logic for expiration if desired)
    if team.deletion_request and team.deletion_request.is_active and (now - team.deletion_request.created_at) > timedelta(days=2):
        team.deletion_request.is_active = False
        for ann in team.announcements:
            if ann.vote_type == 'deletion':
                ann.is_vote_active = False
                ann.content += "\n\n⏰ **VOTE EXPIRED**"
        dirty = True

    # Check Completion
    if team.completion_request and team.completion_request.is_active and (now - team.completion_request.created_at) > timedelta(days=2):
        team.completion_request.is_active = False
        for ann in team.announcements:
            if ann.vote_type == 'completion':
                ann.is_vote_active = False
                ann.content += "\n\n⏰ **VOTE EXPIRED**"
        dirty = True
        
    return dirty

def has_active_vote(team: Team) -> bool:
    if team.deletion_request and team.deletion_request.is_active: return True
    if team.completion_request and team.completion_request.is_active: return True
    if any(r.is_active for r in team.member_requests): return True
    return False

async def clear_swipes(user_id: str, team_id: str, leader_id: str):
    await Swipe.find(Swipe.swiper_id == user_id, Swipe.target_id == team_id).delete()
    await Swipe.find(Swipe.swiper_id == leader_id, Swipe.target_id == user_id).delete()

@router.get("/top")
async def get_top_projects():
    """Returns top 10 projects based on Favorites count (Aggregation)"""
    pipeline = [
        {"$unwind": "$favorites"},
        {"$group": {"_id": "$favorites", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    cursor = User.get_pymongo_collection().aggregate(pipeline)
    agg_results = await cursor.to_list(length=10)
    
    results = []
    for item in agg_results:
        team_id = item["_id"]
        count = item["count"]
        
        # Validate ID format
        if not ObjectId.is_valid(team_id): continue
        
        team = await Team.get(team_id)
        if team:
            # Handle leader fallback logic same as other endpoints
            actual_leader_id = team.leader_id or (team.members[0] if team.members else None)
            
            results.append({
                "id": str(team.id),
                "name": team.name,
                "description": team.description,
                "leader_id": actual_leader_id,
                "favorite_count": count,
                "needed_skills": team.needed_skills[:3]
            })
            
    return results

@router.post("/", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    skills_to_embed = team_data.active_needed_skills if team_data.active_needed_skills else team_data.needed_skills
    team_text = f"{team_data.name} {team_data.description} {' '.join(skills_to_embed)}"
    embedding_vec = generate_embedding(team_text)

    new_team = Team(
        name=team_data.name, 
        description=team_data.description,
        leader_id=str(current_user.id),
        members=[str(current_user.id)], 
        needed_skills=team_data.needed_skills,
        active_needed_skills=team_data.active_needed_skills, 
        project_roadmap={},
        embedding=embedding_vec
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
    if check_vote_expiration(team):
        await team.save()
    actual_leader_id = team.leader_id or (team.members[0] if team.members else None)
    member_objects = []
    rated_ids = []
    for uid in team.members:
        user = await User.get(uid)
        if user:
            member_objects.append({
                "id": str(user.id), "username": user.username,
                "avatar_url": user.avatar_url or "https://github.com/shadcn.png", "email": user.email
            })
            if current_user:
                has_rated = any(
                    r.project_id == str(team.id) and r.rater_id == str(current_user.id) 
                    for r in user.ratings_received
                )
                if has_rated:
                    rated_ids.append(str(user.id))
            
    from app.models import ChatGroup
    chat_group = await ChatGroup.find_one(ChatGroup.team_id == str(team.id))
    
    has_liked = False
    if current_user:
        last_swipe = await Swipe.find(Swipe.swiper_id == str(current_user.id), Swipe.target_id == str(team.id), Swipe.direction == "right").sort("-timestamp").first_or_none()
        if last_swipe and (datetime.now() - last_swipe.timestamp) < timedelta(days=3):
            has_liked = True

    return {
        "id": str(team.id), "name": team.name, "description": team.description,
        "leader_id": actual_leader_id, "members": member_objects,
        "needed_skills": team.needed_skills,
        "active_needed_skills": team.active_needed_skills, 
        "project_roadmap": team.project_roadmap,
        "chat_group_id": str(chat_group.id) if chat_group else None,
        "target_members": team.target_members,
        "target_completion_date": team.target_completion_date,
        "deletion_request": team.deletion_request,
        "completion_request": team.completion_request,
        "member_requests": team.member_requests,
        "status": team.status,
        "has_liked": has_liked,
        "is_looking_for_members": team.is_looking_for_members,
        "announcements": team.announcements,
        "rated_member_ids": rated_ids
    }

@router.put("/{team_id}")
async def update_team_details(team_id: str, data: TeamUpdate, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: raise HTTPException(403, "Only Leader can edit")
    if team.status == "completed": raise HTTPException(400, "Project is locked (Completed)")

    if data.name: team.name = data.name
    if data.description: team.description = data.description
    if data.target_members: team.target_members = data.target_members
    if data.active_needed_skills is not None: team.active_needed_skills = data.active_needed_skills
    if data.is_looking_for_members is not None: team.is_looking_for_members = data.is_looking_for_members
    if data.status: team.status = data.status

    if data.target_completion_date: 
        try:
            team.target_completion_date = datetime.fromisoformat(data.target_completion_date.replace('Z', '+00:00'))
        except: team.target_completion_date = None
    
    skills_text = ' '.join(team.active_needed_skills) if team.active_needed_skills else ' '.join(team.needed_skills)
    team_text = f"{team.name} {team.description} {skills_text}"
    team.embedding = generate_embedding(team_text)
    if not team.leader_id:
        team.leader_id = team.members[0]

    await team.save()
    return team

# --- MEMBER ACTIONS (Invite/Add/Reject) ---

@router.post("/{team_id}/invite")
async def send_invite(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, detail="Team not found")
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    
    real_leader_id = team.leader_id or team.members[0]
    
    is_leader = str(current_user.id) == real_leader_id
    if is_leader:
        candidate_id = req.target_user_id
        leader_id = str(current_user.id)
        new_status = "invited"
        msg = f"Join my team '{team.name}'?"
        type = "team_invite"
    else:
        candidate_id = str(current_user.id)
        leader_id = real_leader_id
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
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    
    candidate_id = req.target_user_id
    leader_id = team.leader_id or team.members[0]
    
    if candidate_id not in team.members:
        team.members.append(candidate_id)
        if len(team.members) >= team.target_members:
            team.is_looking_for_members = False
        await team.save()
        
        # Notifications logic
        if str(current_user.id) == leader_id:
            # Leader accepting join request
            await Notification.find(Notification.recipient_id == leader_id, Notification.sender_id == candidate_id, Notification.type == "join_request", Notification.related_id == team_id).update({"$set": {"action_status": "accepted", "is_read": True}})
        else:
            # Candidate accepting invite
            await Notification.find(Notification.recipient_id == candidate_id, Notification.type == "team_invite", Notification.related_id == team_id).update({"$set": {"action_status": "accepted", "is_read": True}})
        
        candidate_user = await User.get(candidate_id)
        c_name = candidate_user.username if candidate_user else "A new member"
        
        # Welcome notifications
        await Notification(recipient_id=candidate_id, sender_id=leader_id, message=f"Welcome to {team.name}!", type="info").insert()
        if str(current_user.id) != leader_id:
             await Notification(recipient_id=leader_id, sender_id=candidate_id, message=f"{c_name} has joined your team {team.name}!", type="info").insert()

    # Update Match Status
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
    leader_id = team.leader_id or team.members[0]
    is_leader = str(current_user.id) == leader_id
    if is_leader: candidate_id = req.target_user_id
    else: candidate_id = str(current_user.id)
    
    match_record = await Match.find_one(Match.user_id == candidate_id, Match.project_id == team_id)
    if match_record:
        match_record.status = "rejected"
        match_record.rejected_by = str(current_user.id)
        await match_record.save()

    await clear_swipes(candidate_id, team_id, leader_id)
        
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
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    
    leader_id = team.leader_id or team.members[0]
    
    if str(current_user.id) != leader_id: raise HTTPException(403)
    if user_id == leader_id: raise HTTPException(400)
    
    if user_id in team.members:
        team.members.remove(user_id)
        # Clear active votes for this user
        if team.deletion_request and user_id in team.deletion_request.votes:
            del team.deletion_request.votes[user_id]
        if team.completion_request and user_id in team.completion_request.votes:
            del team.completion_request.votes[user_id]
        await team.save()
        await Match.find(Match.user_id == user_id, Match.project_id == team_id).delete()
        await clear_swipes(user_id, team_id, leader_id)
    return team

# --- TASKS ---
@router.post("/{team_id}/tasks")
async def create_task(team_id: str, req: CreateTaskRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: raise HTTPException(403, "Only Leader can assign tasks")
    
    try: dt = datetime.fromisoformat(req.deadline.replace('Z', '+00:00'))
    except ValueError: dt = datetime.now() + timedelta(days=1) 
    new_task = Task(id=str(uuid.uuid4()), description=req.description, assignee_id=req.assignee_id, deadline=dt)
    team.tasks.append(new_task)
    await team.save()
    if req.assignee_id != str(current_user.id):
        await Notification(recipient_id=req.assignee_id, sender_id=str(current_user.id), message=f"New task assigned: {req.description}", type="info", related_id=team_id).insert()
        await manager.send_personal_message({"event": "dashboardUpdate"}, req.assignee_id)
    return {"status": "created"}

@router.delete("/{team_id}/tasks/{task_id}")
async def delete_task(team_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: raise HTTPException(403, "Only Leader can delete tasks")
    
    initial_len = len(team.tasks)
    team.tasks = [t for t in team.tasks if str(t.id) != str(task_id)]
    if len(team.tasks) == initial_len: raise HTTPException(404, "Task not found")
    await team.save()
    return {"status": "deleted"}

@router.post("/{team_id}/tasks/{task_id}/submit")
async def submit_task(team_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    
    task = next((t for t in team.tasks if str(t.id) == str(task_id)), None)
    if not task: raise HTTPException(404, "Task not found")
    if str(current_user.id) != task.assignee_id: raise HTTPException(403)
    
    task.status = "review"
    task.verification_votes = []
    task.rework_votes = []
    await team.save()
    
    for m_id in team.members:
        if m_id != str(current_user.id):
            await Notification(recipient_id=m_id, sender_id=str(current_user.id), message=f"Review needed: {task.description}", type="info", related_id=team_id).insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
    return {"status": "submitted"}

@router.post("/{team_id}/tasks/{task_id}/verify")
async def verify_task(team_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    task = next((t for t in team.tasks if str(t.id) == str(task_id)), None)
    if not task or task.status != "review": raise HTTPException(400, "Invalid task")
    uid = str(current_user.id)
    if uid == task.assignee_id: raise HTTPException(403, "Self-verification not allowed")
    if uid in task.verification_votes or uid in task.rework_votes: raise HTTPException(400, "Already voted")
    task.verification_votes.append(uid)
    total_reviewers = len(team.members)
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
    task = next((t for t in team.tasks if str(t.id) == str(task_id)), None)
    if not task or task.status != "review": raise HTTPException(400, "Invalid task")
    uid = str(current_user.id)
    if uid == task.assignee_id: raise HTTPException(403)
    if uid in task.verification_votes or uid in task.rework_votes: raise HTTPException(400, "Already voted")
    task.rework_votes.append(uid)
    total_reviewers = len(team.members)
    required = math.ceil(total_reviewers * 0.3)
    if len(task.rework_votes) >= required:
        task.status = "rework" 
        await Notification(recipient_id=task.assignee_id, sender_id=uid, message=f"Rework requested for '{task.description}'", type="info", related_id=team_id).insert()
    await team.save()
    return {"status": "voted"}

@router.post("/{team_id}/tasks/{task_id}/extend/initiate")
async def initiate_task_extension(team_id: str, task_id: str, req: ExtensionRequestInput, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    task_idx = next((i for i, t in enumerate(team.tasks) if str(t.id) == str(task_id)), None)
    if task_idx is None: raise HTTPException(404, "Task not found")
    task = team.tasks[task_idx]
    
    leader_id = team.leader_id or team.members[0]
    uid = str(current_user.id)
    if uid != task.assignee_id and uid != leader_id: raise HTTPException(403, "Not allowed")
    
    try: new_dt = datetime.fromisoformat(req.new_deadline.replace('Z', '+00:00'))
    except: raise HTTPException(400, "Invalid date")
    ext_req = ExtensionRequest(is_active=True, requested_deadline=new_dt, initiator_id=uid, votes={uid: "approve"})
    task.extension_request = ext_req
    team.tasks[task_idx] = task 
    
    # IMMEDIATE APPROVAL CHECK
    total = len(team.members)
    threshold = (total // 2) + 1
    if 1 >= threshold:
        task.deadline = new_dt
        task.was_extended = True
        task.warning_sent = False
        task.extension_request = None
        status_msg = "approved_immediately"
    else:
        status_msg = "initiated"
        for m_id in team.members:
            if m_id != uid:
                await Notification(recipient_id=m_id, sender_id=uid, message=f"Deadline extension requested for '{task.description}'.", type="info", related_id=team_id).insert()
                await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)

    await team.save()
    return {"status": status_msg}

@router.post("/{team_id}/tasks/{task_id}/extend/vote")
async def vote_task_extension(team_id: str, task_id: str, vote: VoteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    task_idx = next((i for i, t in enumerate(team.tasks) if str(t.id) == str(task_id)), None)
    if task_idx is None: raise HTTPException(404)
    task = team.tasks[task_idx]
    if not task.extension_request or not task.extension_request.is_active: raise HTTPException(400)
    uid = str(current_user.id)
    if uid not in team.members: raise HTTPException(403)
    task.extension_request.votes[uid] = vote.decision
    
    total = len(team.members)
    approvals = sum(1 for v in task.extension_request.votes.values() if v == "approve")
    threshold = (total // 2) + 1
    status_msg = "voted"
    if approvals >= threshold:
        task.deadline = task.extension_request.requested_deadline
        task.was_extended = True
        task.warning_sent = False
        task.extension_request = None 
        status_msg = "approved"
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Deadline extended for '{task.description}'.", type="info", related_id=team_id).insert()
    elif len(task.extension_request.votes) == total:
        task.extension_request = None
        status_msg = "rejected"
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Extension rejected for '{task.description}'.", type="info", related_id=team_id).insert()
    team.tasks[task_idx] = task
    await team.save()
    return {"status": status_msg}

@router.get("/{team_id}/tasks", response_model=List[TaskDetailResponse])
async def get_team_tasks(team_id: str):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    results = []
    now = datetime.now()
    has_changes = False 
    leader_id = team.leader_id or team.members[0]
    
    for t in team.tasks:
        assignee = await User.get(t.assignee_id)
        is_overdue = False
        if t.status == "completed" and t.completed_at:
            if t.completed_at > t.deadline: is_overdue = True
        elif t.status != "completed":
            if now > t.deadline: is_overdue = True
            time_left = t.deadline - now
            if not t.warning_sent and time_left > timedelta(0) and time_left < timedelta(days=1):
                t.warning_sent = True
                has_changes = True
                await Notification(recipient_id=t.assignee_id, sender_id=leader_id, message=f"Task '{t.description}' deadline in 24h!", type="info", related_id=team_id).insert()
                await manager.send_personal_message({"event": "dashboardUpdate"}, t.assignee_id)
        ext_active = t.extension_request is not None and t.extension_request.is_active
        ext_votes = len(t.extension_request.votes) if ext_active else 0
        ext_req = math.ceil(len(team.members) * 0.5)
        ext_date = t.extension_request.requested_deadline if ext_active else None
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
            "is_overdue": is_overdue,
            "extension_active": ext_active,
            "extension_requested_date": ext_date, 
            "extension_votes": ext_votes,
            "extension_required": ext_req,
            "was_extended": t.was_extended
        })
    if has_changes: await team.save()
    results.sort(key=lambda x: (x["status"] == "completed", not x["is_overdue"], x["deadline"]))
    return results

@router.post("/{team_id}/transfer-leadership")
async def transfer_leadership(team_id: str, req: TransferRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: raise HTTPException(403, "Only Leader can transfer leadership")
    
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    if req.new_leader_id not in team.members: raise HTTPException(400, "New leader must be a member")
    
    team.members.remove(req.new_leader_id)
    team.members.insert(0, req.new_leader_id)
    team.leader_id = req.new_leader_id # <--- UPDATE LEADER ID
    
    chat_group = await ChatGroup.find_one(ChatGroup.team_id == str(team.id))
    if chat_group:
        chat_group.admin_id = req.new_leader_id
        await chat_group.save()
    await team.save()
    return {"status": "leadership_transferred"}

@router.put("/{team_id}/skills", response_model=Team)
async def update_team_skills(team_id: str, data: SkillsUpdate, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    team.needed_skills = data.needed_skills
    team_text = f"{team.name} {team.description} {' '.join(team.needed_skills)}"
    team.embedding = generate_embedding(team_text)
    await team.save()
    return team

@router.post("/suggest-stack")
async def get_stack_suggestions(request: SuggestionRequest, current_user: User = Depends(get_current_user)):
    suggestions = await suggest_tech_stack(request.description, request.current_skills)
    
    # Check for AI validation error
    if suggestions and "error" in suggestions:
        raise HTTPException(status_code=400, detail=suggestions["error"])
        
    return suggestions

@router.post("/{team_id}/roadmap")
async def create_team_roadmap(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    leader_id = team.leader_id or team.members[0]
    if not team or str(current_user.id) != leader_id: raise HTTPException(403)
    
    weeks = 4
    if team.target_completion_date:
        delta = team.target_completion_date - datetime.now(team.target_completion_date.tzinfo)
        weeks = max(1, round(delta.days / 7))
        
    ai_plan = await generate_roadmap(team.description, team.needed_skills, weeks=weeks)
    
    if not ai_plan:
        raise HTTPException(status_code=500, detail="AI Service unavailable. Please try again.")

    # Check for AI validation error
    if "error" in ai_plan:
        raise HTTPException(status_code=400, detail=ai_plan["error"])
        
    team.project_roadmap = ai_plan
    await team.save()
    return team

@router.post("/{team_id}/leave")
async def leave_project(team_id: str, req: ActionWithExplanation, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, "Team not found")
    if has_active_vote(team):
        raise HTTPException(400, "Another vote is currently active. Please wait for it to conclude.")
    uid = str(current_user.id)
    if uid not in team.members: raise HTTPException(400, "Not a member")
    if team.status == "completed": raise HTTPException(400, "Project is completed and locked. You cannot leave.")
    
    leader_id = team.leader_id or team.members[0]
    if uid == leader_id: raise HTTPException(400, "Leader cannot leave. Transfer Leadership first.")
    
    existing = next((r for r in team.member_requests if r.target_user_id == uid and r.is_active), None)
    if existing: raise HTTPException(400, "Request already active")
    
    if team.status == "planning":
        team.members.remove(uid)
        await team.save()
        await Notification(recipient_id=leader_id, sender_id=uid, message=f"{current_user.username} left the team. Reason: {req.explanation}", type="info").insert()
        await manager.send_personal_message({"event": "dashboardUpdate"}, leader_id)
        await Match.find(Match.project_id == team_id, Match.user_id == uid).delete()
        await clear_swipes(uid, team_id, leader_id)
        return {"status": "left"}
    else:
        request = MemberRequest(target_user_id=uid, type="leave", explanation=req.explanation, initiator_id=uid, votes={})
        team.member_requests.append(request)
        sys_announcement = Announcement(
            content=f"⚠️ **MEMBER LEAVE VOTE**\n\n**{current_user.username}** wants to leave the team.\nReason: _{req.explanation}_",
            author_id=uid,
            vote_type="leave",
            vote_related_id=request.id,
            is_vote_active=True
        )
        team.announcements.append(sys_announcement)
        await team.save()
        for m_id in team.members:
            await manager.send_personal_message({
                "event": "dashboardUpdate",
                "message": f"Vote initiated: {current_user.username} wants to leave."
            }, m_id)
            
            if m_id != uid:
                await Notification(recipient_id=m_id, sender_id=uid, message=f"{current_user.username} wants to leave. Vote required.", type="member_request", related_id=team_id).insert()
        return {"status": "vote_initiated"}

@router.post("/{team_id}/members/{user_id}/remove")
async def remove_member_request(team_id: str, user_id: str, req: ActionWithExplanation, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, "Team not found")
    if has_active_vote(team): raise HTTPException(400, "Another vote is currently active. Please wait for it to conclude.")
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: raise HTTPException(403, "Only Leader can remove members")
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    if user_id == leader_id: raise HTTPException(400, "Cannot remove leader")
    if user_id not in team.members: raise HTTPException(400, "User not in team")
    
    target_user = await User.get(user_id)
    target_name = target_user.username if target_user else "Member"
    if team.status == "planning":
        team.members.remove(user_id)
        await team.save()
        await Notification(recipient_id=user_id, sender_id=str(current_user.id), message=f"You were removed from {team.name}. Reason: {req.explanation}", type="info").insert()
        await manager.send_personal_message({"event": "dashboardUpdate"}, user_id)
        await Match.find(Match.project_id == team_id, Match.user_id == user_id).delete()
        return {"status": "removed"}
    else:
        request = MemberRequest(target_user_id=user_id, type="remove", explanation=req.explanation, initiator_id=str(current_user.id), votes={})
        team.member_requests.append(request)
        sys_announcement = Announcement(
            content=f"⚠️ **REMOVE MEMBER VOTE**\n\nVote to remove **{target_name}**.\nReason: _{req.explanation}_",
            author_id=str(current_user.id),
            vote_type="remove_member",
            vote_related_id=request.id, # Link specifically to this request
            is_vote_active=True
        )
        team.announcements.append(sys_announcement)
        await team.save()
        for m_id in team.members:
            await manager.send_personal_message({
                "event": "dashboardUpdate", 
                "message": f"Vote initiated: Remove {target_name}"
            }, m_id)

            if m_id != str(current_user.id): 
                msg = f"Vote to remove {target_name}." if m_id != user_id else f"Vote initiated to remove YOU from {team.name}."
                await Notification(recipient_id=m_id, sender_id=str(current_user.id), message=msg, type="member_request", related_id=team_id).insert()
        return {"status": "vote_initiated"}

@router.post("/{team_id}/member-request/{request_id}/vote")
async def vote_member_request(team_id: str, request_id: str, vote: VoteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, "Team not found")
    req_index = next((i for i, r in enumerate(team.member_requests) if r.id == request_id and r.is_active), None)
    if req_index is None: raise HTTPException(404, "Active request not found")
    req = team.member_requests[req_index]
    uid = str(current_user.id)
    if uid not in team.members: raise HTTPException(403, "Not a member")
    if uid == req.target_user_id:
        raise HTTPException(403, "You cannot vote on a request targeting you.")
    req.votes[uid] = vote.decision
    total_members = len(team.members)
    approvals = sum(1 for v in req.votes.values() if v == "approve")
    threshold = math.ceil((total_members-1) * 0.7)
    
    leader_id = team.leader_id or team.members[0]
    status_msg = "voted"
    if approvals >= threshold:
        req.is_active = False
        target_id = req.target_user_id
        if target_id in team.members:
            team.members.remove(target_id)
            await Match.find(Match.project_id == team_id, Match.user_id == target_id).delete()
            await clear_swipes(target_id, team_id, leader_id)
            action_text = "left" if req.type == "leave" else "removed from"
            await Notification(recipient_id=target_id, sender_id=leader_id, message=f"You have {action_text} {team.name}.", type="info").insert()
            for m_id in team.members:
                await Notification(recipient_id=m_id, sender_id=uid, message=f"Vote passed. Member {action_text} the team.", type="info").insert()
                await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
        status_msg = "approved"
    elif len(req.votes) == total_members-1:
        req.is_active = False
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Vote failed for member {req.type}.", type="info").insert()
        status_msg = "rejected"
    team.member_requests[req_index] = req
    if status_msg == "approved":
        for ann in team.announcements:
            if ann.vote_related_id == request_id:
                ann.is_vote_active = False
                ann.vote_result = "passed"
    elif status_msg == "rejected":
        for ann in team.announcements:
            if ann.vote_related_id == request_id:
                ann.is_vote_active = False
                ann.vote_result = "failed"
    await team.save()
    return {"status": status_msg}

@router.post("/{team_id}/delete/initiate")
async def initiate_deletion(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if has_active_vote(team): raise HTTPException(400, "Another vote is currently active. Please wait for it to conclude.")
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: raise HTTPException(403)
    if team.status == "completed": raise HTTPException(400, "Project is locked")
    if len(team.members) == 1:
        await team.delete()
        return {"status": "deleted"}
    uid = str(current_user.id)
    req = DeletionRequest(is_active=True, initiator_id=uid, votes={})
    team.deletion_request = req

    sys_announcement = Announcement(
        content="🚨 **PROJECT DELETION VOTE**\n\nThe leader has requested to delete this project.",
        author_id=uid,
        vote_type="deletion",
        vote_related_id="deletion",
        is_vote_active=True
    )
    team.announcements.append(sys_announcement)

    await team.save()
    for member_id in team.members:
        await manager.send_personal_message({
            "event": "dashboardUpdate",
            "message": "Deletion Vote Initiated"
        }, member_id)
        
        if member_id != uid:
            notif = Notification(recipient_id=member_id, sender_id=uid, message=f"Vote to DELETE project '{team.name}'.", type="deletion_request", related_id=team_id)
            await notif.insert()
    return {"status": "initiated"}

@router.post("/{team_id}/delete/vote")
async def vote_deletion(team_id: str, vote: VoteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if not team.deletion_request or not team.deletion_request.is_active: raise HTTPException(400)
    
    uid = str(current_user.id)
    team.deletion_request.votes[uid] = vote.decision

    await Notification.find(Notification.recipient_id == uid, Notification.type == "deletion_request", Notification.related_id == team_id).update({"$set": {"action_status": "voted", "is_read": True}})
    
    total = len(team.members)
    approvals = sum(1 for v in team.deletion_request.votes.values() if v == "approve")
    
    # 1. Consensus Reached (Deleted)
    if approvals >= math.ceil(total * 0.7):
        await team.delete()
        await ChatGroup.find(ChatGroup.team_id == team_id).delete()
        await Match.find(Match.project_id == team_id).delete()
        for m_id in team.members:
            await manager.send_personal_message({"event": "team_deleted", "message": f"Project '{team.name}' deleted."}, m_id)
        return {"status": "deleted"}
        
    # 2. Vote Failed (Kept) - UPDATE ANNOUNCEMENT HERE
    if len(team.deletion_request.votes) == total:
        team.deletion_request = None
        
        # Update Announcement
        for ann in team.announcements:
            if ann.vote_type == 'deletion' and ann.is_vote_active:
                ann.is_vote_active = False
                ann.vote_result = "failed"
        
        await team.save()
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Vote failed. Project '{team.name}' kept.", type="info").insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
        return {"status": "kept"}
        
    await team.save()
    return {"status": "voted"}

@router.post("/{team_id}/complete/initiate")
async def initiate_completion(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if has_active_vote(team): raise HTTPException(400, "Another vote is currently active. Please wait for it to conclude.")
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: raise HTTPException(403)
    if len(team.members) == 1:
        team.status = "completed"
        team.is_looking_for_members = False
        await team.save()
        return {"status": "completed"}
    uid = str(current_user.id)
    req = CompletionRequest(is_active=True, initiator_id=uid, votes={})
    team.completion_request = req
    sys_announcement = Announcement(
        content="🏆 **PROJECT COMPLETION VOTE**\n\nThe leader wants to mark this project as complete.",
        author_id=uid,
        vote_type="completion",
        vote_related_id="completion",
        is_vote_active=True
    )
    team.announcements.append(sys_announcement)
    await team.save()
    for member_id in team.members:
        await manager.send_personal_message({
            "event": "dashboardUpdate",
            "message": "Completion Vote Initiated"
        }, member_id)

        if member_id != uid:
            notif = Notification(recipient_id=member_id, sender_id=uid, message=f"Vote to mark project '{team.name}' as COMPLETED.", type="completion_request", related_id=team_id)
            await notif.insert()

    return {"status": "initiated"}

@router.post("/{team_id}/complete/vote")
async def vote_completion(team_id: str, vote: VoteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if not team.completion_request or not team.completion_request.is_active: raise HTTPException(400)
    
    uid = str(current_user.id)
    team.completion_request.votes[uid] = vote.decision
    
    # REMOVED INCORRECT BLOCK HERE

    await Notification.find(Notification.recipient_id == uid, Notification.type == "completion_request", Notification.related_id == team_id).update({"$set": {"action_status": "voted", "is_read": True}})
    
    total = len(team.members)
    approvals = sum(1 for v in team.completion_request.votes.values() if v == "approve")
    
    # 1. Consensus Reached (Completed) - UPDATE ANNOUNCEMENT HERE
    if approvals >= math.ceil(total * 0.7):
        team.status = "completed"
        team.is_looking_for_members = False 
        team.completion_request = None 
        
        # Update Announcement
        for ann in team.announcements:
            if ann.vote_type == 'completion' and ann.is_vote_active:
                ann.is_vote_active = False
                ann.vote_result = "passed"

        await team.save()
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Project '{team.name}' completed! Rate your team now.", type="rating", related_id=team_id).insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
        return {"status": "completed"}
        
    # 2. Vote Failed (Kept) - UPDATE ANNOUNCEMENT HERE
    if len(team.completion_request.votes) == total:
        team.completion_request = None
        
        # Update Announcement
        for ann in team.announcements:
            if ann.vote_type == 'completion' and ann.is_vote_active:
                ann.is_vote_active = False
                ann.vote_result = "failed"

        await team.save()
        for m_id in team.members:
            await Notification(recipient_id=m_id, sender_id=uid, message=f"Completion vote failed for '{team.name}'.", type="info").insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, m_id)
        return {"status": "kept"}
        
    await team.save()
    return {"status": "voted"}

@router.post("/{team_id}/rate")
async def rate_teammate(team_id: str, req: RatingRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    if str(current_user.id) not in team.members or req.target_user_id not in team.members: raise HTTPException(403)
    
    target = await User.get(req.target_user_id)
    if target:
        # 1. Parse Breakdown
        bd = req.breakdown
        technical = bd.get('technical', 5)
        communication = bd.get('communication', 5)
        collaboration = bd.get('collaboration', 5)
        reliability = bd.get('reliability', 5)
        problem_solving = bd.get('problem_solving', 5)
        
        # 2. Calculate Average Score
        avg_score = (technical + communication + collaboration + reliability + problem_solving) / 5.0
        
        # 3. Update User Trust Score (Weighted Average)
        current_score = target.trust_score
        count = target.rating_count
        new_global_score = ((current_score * count) + avg_score) / (count + 1)
        
        target.trust_score = round(new_global_score, 1)
        target.rating_count += 1
        
        # 4. Create Rating Object
        breakdown_obj = RatingBreakdown(
            technical=technical, communication=communication, 
            collaboration=collaboration, reliability=reliability, 
            problem_solving=problem_solving
        )
        
        new_rating = Rating(
            project_id=team_id, 
            project_name=team.name, 
            rater_id=str(current_user.id), 
            rater_name=current_user.username, 
            score=round(avg_score, 1), 
            breakdown=breakdown_obj,
            explanation=req.explanation
        )
        
        target.ratings_received.insert(0, new_rating)
        await target.save()
        
    return {"status": "rated"}

@router.post("/{team_id}/reset")
async def reset_match(team_id: str, req: InviteRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404)
    leader_id = team.leader_id or team.members[0]
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

@router.post("/{team_id}/announcements")
async def post_announcement(team_id: str, req: AnnouncementRequest, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, "Team not found")
    
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: 
        raise HTTPException(403, "Only the Leader can post announcements")
    
    # Create Announcement
    new_announcement = Announcement(
        content=req.content,
        author_id=str(current_user.id)
    )
    
    team.announcements.append(new_announcement)
    await team.save()
    
    # Notify all members (except leader)
    for member_id in team.members:
        if member_id != str(current_user.id):
            notif = Notification(
                recipient_id=member_id,
                sender_id=str(current_user.id),
                message=f"📢 New Announcement in {team.name}: {req.content[:30]}...",
                type="info",
                related_id=team_id
            )
            await notif.insert()
            await manager.send_personal_message({"event": "dashboardUpdate"}, member_id)
            
    return {"status": "posted", "announcement": new_announcement}

@router.delete("/{team_id}/announcements/{announcement_id}")
async def delete_announcement(team_id: str, announcement_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, "Team not found")
    
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: 
        raise HTTPException(403, "Only the Leader can delete announcements")
        
    initial_len = len(team.announcements)
    team.announcements = [a for a in team.announcements if a.id != announcement_id]
    
    if len(team.announcements) == initial_len:
        raise HTTPException(404, "Announcement not found")
        
    await team.save()
    return {"status": "deleted"}

@router.put("/{team_id}/announcements/{announcement_id}")
async def update_announcement(team_id: str, announcement_id: str, req: AnnouncementUpdate, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, "Team not found")
    
    # Only Leader or Author can edit (assuming Leader for now based on your request)
    leader_id = team.leader_id or team.members[0]
    if str(current_user.id) != leader_id: 
        raise HTTPException(403, "Only the Leader can edit announcements")
        
    # Find and update
    found = False
    for ann in team.announcements:
        if ann.id == announcement_id:
            ann.content = req.content
            found = True
            break
            
    if not found:
        raise HTTPException(404, "Announcement not found")
        
    await team.save()
    
    # Optional: Notify members of update
    for member_id in team.members:
        if member_id != str(current_user.id):
            # Send real-time trigger
            await manager.send_personal_message({
                "event": "dashboardUpdate", 
                "message": f"Announcement updated in {team.name}"
            }, member_id)
            
    return {"status": "updated", "announcements": team.announcements}