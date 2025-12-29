from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from app.models import (
    User, Skill, DayAvailability, TimeRange, Block, Link, Achievement, 
    ConnectedAccounts, Education, Team, VisibilitySettings, Notification,
    ChatGroup, Message, UnreadCount, Match, Swipe
)
from app.auth.dependencies import get_current_user
from app.services.vector_store import generate_embedding
from app.auth.utils import fetch_codeforces_stats, fetch_leetcode_stats, update_trust_score
from app.services.matching_service import calculate_user_compatibility
from beanie.operators import Or
from bson import ObjectId
from datetime import datetime

router = APIRouter()

class ProfileUpdate(BaseModel):
    skills: List[str]
    interests: List[str]
    about: str
    availability: List[DayAvailability]
    is_looking_for_team: bool = True
    full_name: Optional[str] = None  # <--- ADDED
    avatar_url: Optional[str] = None # <--- ADDED
    
    # New Fields
    age: Optional[str] = None
    education: List[Education] = []
    social_links: List[Link] = []
    professional_links: List[Link] = []
    achievements: List[Achievement] = []

class ConnectRequest(BaseModel):
    handle_or_url: str

class SkillsUpdate(BaseModel):
    skills: List[str]

class VisibilityUpdate(BaseModel):
    settings: VisibilitySettings

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    # --- AUTO-FIX FOR LEGACY DATA ---
    # If user has GitHub ID but connected_accounts.github is empty, fix it.
    if current_user.github_id and (not current_user.connected_accounts or not current_user.connected_accounts.github):
        if not current_user.connected_accounts:
            current_user.connected_accounts = ConnectedAccounts()
        # Use username as fallback for handle if we don't have the specific login saved
        current_user.connected_accounts.github = current_user.username 
        await current_user.save()
    
    return current_user

# --- BLOCKING FEATURE (NEW) ---

@router.post("/{user_id}/block")
async def block_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Blocks a user and cleans up connections/matches"""
    if user_id == str(current_user.id): raise HTTPException(400, "Cannot block self")
    
    # 1. Create Block Entry
    await Block(blocker_id=str(current_user.id), blocked_id=user_id).insert()
    
    # 2. Remove Connections (Chat Requests)
    target = await User.get(user_id)
    if target:
        if user_id in current_user.accepted_chat_requests:
            current_user.accepted_chat_requests.remove(user_id)
            await current_user.save()
        if str(current_user.id) in target.accepted_chat_requests:
            target.accepted_chat_requests.remove(str(current_user.id))
            await target.save()
            
    # 3. Delete Matches & Swipes
    await Match.find(Match.user_id == str(current_user.id), Match.leader_id == user_id).delete()
    await Match.find(Match.user_id == user_id, Match.leader_id == str(current_user.id)).delete()
    
    await Swipe.find(Swipe.swiper_id == str(current_user.id), Swipe.target_id == user_id).delete()
    await Swipe.find(Swipe.swiper_id == user_id, Swipe.target_id == str(current_user.id)).delete()
    
    # 4. Delete Notifications (Invites/Requests)
    await Notification.find(Notification.sender_id == str(current_user.id), Notification.recipient_id == user_id).delete()
    await Notification.find(Notification.sender_id == user_id, Notification.recipient_id == str(current_user.id)).delete()
    
    # 5. Remove from Teams where blocker is leader? (Optional based on 'wont appear for project matches', but usually blocking implies removing from potential future interactions. Removing from existing active teams is drastic but requested 'remove trace'.)
    # For now, we stick to removing matches/connections. Removing from active team is complex logic (votes etc).
    
    return {"status": "blocked"}

@router.post("/{user_id}/unblock")
async def unblock_user(user_id: str, current_user: User = Depends(get_current_user)):
    await Block.find(Block.blocker_id == str(current_user.id), Block.blocked_id == user_id).delete()
    return {"status": "unblocked"}

# --- NETWORK & CONNECTIONS (UPDATED) ---

@router.get("/network", response_model=List[User])
async def get_my_network(current_user: User = Depends(get_current_user)):
    my_id = str(current_user.id)
    
    # Fetch Blocked List
    blocks = await Block.find({"$or": [{"blocker_id": my_id}, {"blocked_id": my_id}]}).to_list()
    blocked_ids = set([b.blocked_id if b.blocker_id == my_id else b.blocker_id for b in blocks])

    teams = await Team.find(Team.members == my_id).to_list()
    connected_ids = set()
    for t in teams:
        for m in t.members:
            if m != my_id: connected_ids.add(m)
    
    if current_user.accepted_chat_requests:
        for c in current_user.accepted_chat_requests: connected_ids.add(c)
        
    # Filter out blocked
    final_ids = [uid for uid in connected_ids if uid not in blocked_ids]
    
    if not final_ids: return []
    valid_ids = [ObjectId(uid) for uid in final_ids if ObjectId.is_valid(uid)]
    users = await User.find({"_id": {"$in": valid_ids}}).to_list()
    return users

@router.get("/search", response_model=List[dict])
async def search_users_directory(query: Optional[str] = None, skill: Optional[str] = None, current_user: User = Depends(get_current_user)):
    my_id = str(current_user.id)
    
    # Fetch Blocked List
    blocks = await Block.find({"$or": [{"blocker_id": my_id}, {"blocked_id": my_id}]}).to_list()
    blocked_ids = set([b.blocked_id if b.blocker_id == my_id else b.blocker_id for b in blocks])

    teams = await Team.find(Team.members == my_id).to_list()
    connected_ids = set(current_user.accepted_chat_requests)
    for t in teams:
        for m in t.members: connected_ids.add(m)

    all_users = await User.find_all().to_list()
    results = []
    q_lower = query.lower() if query else ""
    s_lower = skill.lower() if skill else ""
    
    for u in all_users:
        if str(u.id) == my_id: continue
        if str(u.id) in blocked_ids: continue # Skip blocked users
        
        match_q = True
        if q_lower: match_q = q_lower in u.username.lower() or (u.full_name and q_lower in u.full_name.lower())
        match_s = True
        if s_lower: match_s = any(s_lower in s.name.lower() for s in u.skills)
            
        if match_q and match_s:
            is_conn = str(u.id) in connected_ids
            pending = await Notification.find_one(
                Notification.recipient_id == str(u.id), 
                Notification.sender_id == my_id,
                Notification.type == "connection_request",
                Notification.action_status == "pending"
            )
            results.append({
                "id": str(u.id),
                "username": u.username,
                "full_name": u.full_name,
                "avatar_url": u.avatar_url,
                "skills": u.skills,
                "is_connected": is_conn,
                "request_sent": bool(pending)
            })
    return results

@router.post("/connection-request/{target_id}")
async def send_connection_request(target_id: str, current_user: User = Depends(get_current_user)):
    if not ObjectId.is_valid(target_id): raise HTTPException(400, "Invalid ID")
    
    # Check Block
    is_blocked = await Block.find_one({"$or": [
        {"blocker_id": str(current_user.id), "blocked_id": target_id},
        {"blocker_id": target_id, "blocked_id": str(current_user.id)}
    ]})
    if is_blocked: raise HTTPException(403, "Cannot connect with this user")

    target = await User.get(target_id)
    if not target: raise HTTPException(404, "User not found")
        
    existing = await Notification.find_one(
        Notification.recipient_id == target_id, 
        Notification.sender_id == str(current_user.id),
        Notification.type == "connection_request",
        Notification.action_status == "pending"
    )
    if existing: return {"status": "already_sent"}

    await Notification(
        recipient_id=target_id,
        sender_id=str(current_user.id),
        message=f"{current_user.username} wants to add you to their network.",
        type="connection_request",
        related_id=str(current_user.id),
        action_status="pending"
    ).insert()
    return {"status": "sent"}
# --- REQUEST MANAGEMENT ---

@router.get("/requests/received", response_model=List[dict])
async def get_received_requests(current_user: User = Depends(get_current_user)):
    notifs = await Notification.find(Notification.recipient_id == str(current_user.id), Notification.type == "connection_request", Notification.action_status == "pending").to_list()
    results = []
    for n in notifs:
        sender = await User.get(n.sender_id)
        if sender:
            # Filter blocked senders
            is_blocked = await Block.find_one({"$or": [{"blocker_id": str(current_user.id), "blocked_id": str(sender.id)}, {"blocker_id": str(sender.id), "blocked_id": str(current_user.id)}]})
            if is_blocked: continue

            sender_dict = sender.dict()
            sender_dict["id"] = str(sender.id)
            if "_id" in sender_dict: sender_dict["_id"] = str(sender.id)
            results.append({"request_id": str(n.id), "user": sender_dict, "created_at": n.created_at})
    return results

@router.get("/requests/sent", response_model=List[dict])
async def get_sent_requests(current_user: User = Depends(get_current_user)):
    notifs = await Notification.find(
        Notification.sender_id == str(current_user.id),
        Notification.type == "connection_request",
        Notification.action_status == "pending"
    ).to_list()
    
    results = []
    for n in notifs:
        recipient = await User.get(n.recipient_id)
        if recipient:
            # FIX: Manually Convert to Dict and ensure ID is string
            recipient_dict = recipient.dict()
            recipient_dict["id"] = str(recipient.id)
            if "_id" in recipient_dict: recipient_dict["_id"] = str(recipient.id)

            results.append({
                "request_id": str(n.id),
                "user": recipient_dict,
                "created_at": n.created_at
            })
    return results

@router.post("/requests/{request_id}/accept")
async def accept_connection_request(request_id: str, current_user: User = Depends(get_current_user)):
    if not ObjectId.is_valid(request_id): raise HTTPException(400, "Invalid ID")
    notif = await Notification.get(request_id)
    if not notif or notif.recipient_id != str(current_user.id):
        raise HTTPException(404, "Request not found")
        
    sender = await User.get(notif.sender_id)
    if sender:
        if notif.sender_id not in current_user.accepted_chat_requests:
            current_user.accepted_chat_requests.append(notif.sender_id)
            await current_user.save()
            
        if str(current_user.id) not in sender.accepted_chat_requests:
            sender.accepted_chat_requests.append(str(current_user.id))
            await sender.save()
            
        notif.action_status = "accepted"
        notif.is_read = True
        await notif.save()
        
        await Notification(
            recipient_id=notif.sender_id,
            sender_id=str(current_user.id),
            message=f"{current_user.username} accepted your connection request.",
            type="info"
        ).insert()
        
        return {"status": "accepted"}
    raise HTTPException(404, "Sender user not found")

@router.post("/requests/{request_id}/reject")
async def reject_connection_request(request_id: str, current_user: User = Depends(get_current_user)):
    if not ObjectId.is_valid(request_id): raise HTTPException(400, "Invalid ID")
    notif = await Notification.get(request_id)
    if not notif or notif.recipient_id != str(current_user.id):
        raise HTTPException(404, "Request not found")
        
    notif.action_status = "rejected"
    notif.is_read = True
    await notif.save()
    return {"status": "rejected"}

@router.get("/{user_id}/compatibility")
async def get_user_compatibility_score(user_id: str, current_user: User = Depends(get_current_user)):
    """Calculates AI compatibility between current user and target user"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid User ID")
        
    if user_id == str(current_user.id):
        return {"score": 100} 
        
    target_user = await User.get(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    score = await calculate_user_compatibility(current_user, target_user)
    return {"score": score}

@router.delete("/me", response_model=dict)
async def delete_my_account(current_user: User = Depends(get_current_user)):
    """
    Permanently deletes the user account.
    Requirement: User must NOT be a member of any active or planning team.
    """
    user_id = str(current_user.id)

    # 1. Validation: Check for Active/Planning Teams
    # We allow deletion if the user is ONLY in 'completed' teams (or no teams).
    active_teams = await Team.find(
        Team.members == user_id,
        Team.status != "completed" 
    ).to_list()

    if active_teams:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete account. You are currently a member of {len(active_teams)} active or planning project(s). Please leave or delete these projects first."
        )

    # 2. Cleanup: Remove from Completed Teams
    all_teams = await Team.find(Team.members == user_id).to_list()
    for team in all_teams:
        if user_id in team.members:
            team.members.remove(user_id)
            # If user was leader, leader_id remains pointing to deleted user or handle specifically.
            # Since the project is completed, it's acceptable for historical data to be static 
            # or we can set it to a placeholder.
            if team.leader_id == user_id:
                team.leader_id = "DELETED_USER"
            await team.save()

    # 3. Cleanup: Chat Groups & Messages
    chat_groups = await ChatGroup.find(ChatGroup.members == user_id).to_list()
    for group in chat_groups:
        if user_id in group.members:
            group.members.remove(user_id)
            # If group becomes empty, delete it
            if len(group.members) == 0:
                await group.delete()
            else:
                await group.save()
    
    # Delete all messages sent by this user
    await Message.find(Message.sender_id == user_id).delete()
    # Delete unread counts
    await UnreadCount.find(UnreadCount.user_id == user_id).delete()
    await UnreadCount.find(UnreadCount.target_id == user_id).delete()

    # 4. Cleanup: Connections
    # Remove this user from others' accepted_chat_requests
    connected_users = await User.find(User.accepted_chat_requests == user_id).to_list()
    for u in connected_users:
        if user_id in u.accepted_chat_requests:
            u.accepted_chat_requests.remove(user_id)
            await u.save()

    # 5. Cleanup: Matching & Social Data
    await Match.find(Match.user_id == user_id).delete()
    await Match.find(Match.leader_id == user_id).delete()
    
    await Swipe.find(Swipe.swiper_id == user_id).delete()
    await Swipe.find(Swipe.target_id == user_id).delete()
    
    await Notification.find(Notification.recipient_id == user_id).delete()
    await Notification.find(Notification.sender_id == user_id).delete()
    
    await Block.find(Block.blocker_id == user_id).delete()
    await Block.find(Block.blocked_id == user_id).delete()

    # 6. Final Execution: Delete User
    await current_user.delete()

    return {"status": "deleted", "message": "Account and all associated data permanently deleted."}

# --- FAVORITES ---

@router.post("/favorites/{team_id}")
async def toggle_favorite(team_id: str, current_user: User = Depends(get_current_user)):
    if not team_id: raise HTTPException(400, "Invalid Team ID")
    
    if team_id in current_user.favorites:
        current_user.favorites.remove(team_id)
        status = "removed"
    else:
        current_user.favorites.append(team_id)
        status = "added"
        
    await current_user.save()
    return {"status": status, "favorites": current_user.favorites}

@router.get("/me/favorites_details", response_model=List[Team])
async def get_my_favorites(current_user: User = Depends(get_current_user)):
    """Fetches full team details for favorited projects"""
    if not current_user.favorites:
        return []
    
    # Filter out invalid IDs just in case
    valid_ids = [ObjectId(tid) for tid in current_user.favorites if ObjectId.is_valid(tid)]
    if not valid_ids:
        return []
        
    teams = await Team.find({"_id": {"$in": valid_ids}}).to_list()
    return teams

# --- DASHBOARD ENDPOINTS ---

@router.get("/me/tasks")
async def get_my_tasks(current_user: User = Depends(get_current_user)):
    """Fetches all tasks assigned to the current user across all projects."""
    teams = await Team.find(Team.members == str(current_user.id)).to_list()
    active_tasks = []
    history_tasks = []
    
    for team in teams:
        for task in team.tasks:
            if task.assignee_id == str(current_user.id):
                t_dict = task.dict()
                t_dict["project_id"] = str(team.id)
                t_dict["project_name"] = team.name
                
                if task.status == "completed":
                    history_tasks.append(t_dict)
                else:
                    active_tasks.append(t_dict)
                    
    active_tasks.sort(key=lambda x: x['deadline'])
    history_tasks.sort(key=lambda x: x['deadline'], reverse=True)
    
    return {"active": active_tasks, "history": history_tasks}

@router.get("/me/projects")
async def get_my_projects(current_user: User = Depends(get_current_user)):
    """Fetches all projects the user is a member of."""
    teams = await Team.find(Team.members == str(current_user.id)).to_list()
    return teams

# -----------------------------------

@router.put("/profile", response_model=User)
async def update_profile(data: ProfileUpdate, current_user: User = Depends(get_current_user)):
    new_skills = [Skill(name=s, level="Intermediate") for s in data.skills]
    current_user.skills = new_skills
    current_user.interests = data.interests
    current_user.about = data.about
    current_user.availability = data.availability
    current_user.is_looking_for_team = data.is_looking_for_team
    
    # Save New Fields
    if data.full_name is not None: current_user.full_name = data.full_name
    if data.avatar_url is not None: current_user.avatar_url = data.avatar_url
    current_user.age = data.age
    current_user.education = data.education
    current_user.social_links = data.social_links
    current_user.professional_links = data.professional_links
    current_user.achievements = data.achievements
    
    # Embedding generation
    achievements_text = " ".join([a.title for a in data.achievements])
    edu_text = " ".join([f"{e.course} at {e.institute}" for e in data.education if e.is_visible])
    profile_text = f"{' '.join(data.skills)} {' '.join(data.interests)} {data.about} {edu_text} {achievements_text}"
    current_user.embedding = generate_embedding(profile_text)
    
    # Recalculate trust score to ensure consistency (e.g. if linkedIn score was wrong)
    await update_trust_score(current_user)
    
    await current_user.save()
    return current_user

@router.put("/visibility", response_model=User)
async def update_visibility(data: VisibilityUpdate, current_user: User = Depends(get_current_user)):
    current_user.visibility_settings = data.settings
    await current_user.save()
    return current_user

@router.post("/connect/{platform}")
async def connect_platform(platform: str, req: ConnectRequest, current_user: User = Depends(get_current_user)):
    """
    Connects external platforms, verifies them by fetching data, and boosts trust score.
    """
    platform = platform.lower()
    stats_data = {}

    if platform == "linkedin":
        if "linkedin.com/in/" not in req.handle_or_url:
            raise HTTPException(400, "Invalid LinkedIn Profile URL")
        current_user.connected_accounts.linkedin = req.handle_or_url
        stats_data = {"url": req.handle_or_url, "verified": True}
        
    elif platform == "codeforces":
        stats = await fetch_codeforces_stats(req.handle_or_url)
        if not stats:
            raise HTTPException(404, "Codeforces handle not found")
        current_user.connected_accounts.codeforces = req.handle_or_url
        stats_data = {
            "handle": req.handle_or_url,
            "rating": stats.get("rating", "Unrated"),
            "rank": stats.get("rank", "Newbie"),
            "maxRating": stats.get("maxRating", 0)
        }
        
    elif platform == "leetcode":
        stats = await fetch_leetcode_stats(req.handle_or_url)
        if not stats:
            raise HTTPException(404, "LeetCode user not found")
        
        total_solved = 0
        if "submitStats" in stats:
            ac_submissions = stats.get("submitStats", {}).get("acSubmissionNum", [])
            for item in ac_submissions:
                if item["difficulty"] == "All":
                    total_solved = item["count"]

        current_user.connected_accounts.leetcode = req.handle_or_url
        stats_data = {
            "username": req.handle_or_url,
            "total_solved": total_solved
        }
    
    else:
        raise HTTPException(400, "Invalid platform")

    if not current_user.platform_stats:
        current_user.platform_stats = {}
    current_user.platform_stats[platform] = stats_data

    await update_trust_score(current_user)
    await current_user.save()
        
    return {
        "status": "connected", 
        "trust_score": current_user.trust_score, 
        "breakdown": current_user.trust_score_breakdown,
        "account": req.handle_or_url,
        "stats": stats_data
    }

@router.put("/skills", response_model=User)
async def update_skills_legacy(data: SkillsUpdate, current_user: User = Depends(get_current_user)):
    new_skills = [Skill(name=s, level="Intermediate") for s in data.skills]
    current_user.skills = new_skills
    
    profile_text = f"{' '.join(data.skills)} {' '.join(current_user.interests)} {current_user.about or ''}"
    current_user.embedding = generate_embedding(profile_text)
    
    await current_user.save()
    return current_user

@router.get("/{user_id}", response_model=User)
async def get_user_details(user_id: str, current_user: User = Depends(get_current_user)):
    if not ObjectId.is_valid(user_id): raise HTTPException(status_code=404, detail="Invalid ID")
    
    is_blocked = await Block.find_one({"$or": [
        {"blocker_id": user_id, "blocked_id": str(current_user.id)},
        {"blocker_id": str(current_user.id), "blocked_id": user_id}
    ]})
    if is_blocked:
        raise HTTPException(status_code=403, detail="Profile Unavailable")

    try:
        user = await User.get(user_id)
        if not user: raise HTTPException(404, detail="User not found")
        return user
    except Exception as e: raise HTTPException(500, detail=str(e))