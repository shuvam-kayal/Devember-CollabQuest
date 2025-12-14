from fastapi import APIRouter, Depends
from typing import List, Optional
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

@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """
    Mark as read. Only update action_status if a specific status (accepted/rejected) is passed.
    """
    notif = await Notification.get(notif_id)
    if notif and notif.recipient_id == str(current_user.id):
        notif.is_read = True
        
        # FIX: Only update status if it is a valid action. 
        # Prevents "read" string from overwriting None and hiding buttons.
        if status and status in ["accepted", "rejected"]:
            notif.action_status = status
            
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