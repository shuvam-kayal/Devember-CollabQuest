from fastapi import APIRouter, Depends
from typing import List
from app.models import Notification, User
from app.auth.dependencies import get_current_user
from beanie.operators import In

router = APIRouter()

@router.get("/", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifs = await Notification.find(
        Notification.recipient_id == str(current_user.id)
    ).sort("-created_at").to_list()
    return notifs

# --- UPDATED: Accepts status query param ---
@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, status: str = "read", current_user: User = Depends(get_current_user)):
    """
    Mark as read AND update status (accepted/rejected).
    """
    notif = await Notification.get(notif_id)
    if notif and notif.recipient_id == str(current_user.id):
        notif.is_read = True
        notif.action_status = status # Save the decision
        await notif.save()
    return {"status": "ok"}

@router.post("/read-all")
async def mark_all_read(current_user: User = Depends(get_current_user)):
    """
    Marks informational notifications as read.
    """
    await Notification.find(
        Notification.recipient_id == str(current_user.id),
        Notification.is_read == False,
        In(Notification.type, ["info", "match", "like"]) 
    ).update({"$set": {"is_read": True}})
    
    return {"status": "ok"}