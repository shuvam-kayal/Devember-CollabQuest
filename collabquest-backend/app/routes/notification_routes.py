from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from app.models import Notification, User, Team
from app.auth.dependencies import get_current_user
from beanie import PydanticObjectId
from beanie.operators import In

router = APIRouter()

class EnrichedNotification(BaseModel):
    id: PydanticObjectId
    type: str
    is_read: bool
    action_status: Optional[str] = "pending"
    sender_id: str
    related_id: Optional[str] = None
    message: str
    created_at: Any
    data: Dict[str, Any] = {}

@router.get("/", response_model=List[EnrichedNotification])
async def get_notifications(
    limit: int = 20, 
    offset: int = 0, 
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch raw notifications
    notifs = await Notification.find(
        Notification.recipient_id == str(current_user.id)
    ).sort("-created_at").skip(offset).limit(limit).to_list()

    if not notifs:
        return []

    # 2. Collect IDs (Strings)
    user_ids_str = set()
    team_ids_str = set()
    
    for n in notifs:
        if n.sender_id: user_ids_str.add(n.sender_id)
        if n.related_id: team_ids_str.add(n.related_id)

    # 3. Convert to ObjectIds for Querying (THE FIX 🛠️)
    user_object_ids = []
    for uid in user_ids_str:
        try:
            user_object_ids.append(PydanticObjectId(uid))
        except:
            pass # Ignore invalid IDs

    team_object_ids = []
    for tid in team_ids_str:
        try:
            team_object_ids.append(PydanticObjectId(tid))
        except:
            pass

    # 4. Batch Fetch Data
    users = await User.find(In(User.id, user_object_ids)).to_list()
    # Map using STRING keys so we can look them up easily later
    user_map = {str(u.id): u for u in users}

    teams = await Team.find(In(Team.id, team_object_ids)).to_list()
    team_map = {str(t.id): t for t in teams}

    # 5. Enrich
    enriched_list = []
    for n in notifs:
        # Resolve Sender
        sender = user_map.get(n.sender_id)
        sender_data = {
            "name": sender.username if sender else "Unknown User",
            "avatar": sender.avatar_url if sender else "https://github.com/shadcn.png"
        }

        # Resolve Team
        team_data = {}
        if n.related_id:
            team = team_map.get(n.related_id)
            team_data = {
                "name": team.name if team else "Unknown Project"
            }

        enriched_list.append({
            "id": n.id,
            "type": n.type,
            "is_read": n.is_read,
            "action_status": n.action_status,
            "sender_id": n.sender_id,
            "related_id": n.related_id,
            "message": n.message,
            "created_at": n.created_at,
            "data": {
                "candidate_name": sender_data['name'],
                "candidate_avatar": sender_data['avatar'],
                "project_name": team_data.get('name', '')
            }
        })

    return enriched_list

@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    notif = await Notification.get(notif_id)
    if notif and notif.recipient_id == str(current_user.id):
        notif.is_read = True
        if status: notif.action_status = status
        await notif.save()
    return {"status": "ok"}

@router.post("/read-all")
async def mark_all_read(current_user: User = Depends(get_current_user)):
    await Notification.find(
        Notification.recipient_id == str(current_user.id),
        Notification.is_read == False
    ).update({"$set": {"is_read": True}})
    return {"status": "ok"}