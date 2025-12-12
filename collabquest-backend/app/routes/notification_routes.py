from fastapi import APIRouter, Depends
from typing import List
from app.models import Notification, User
from app.auth.dependencies import get_current_user

router = APIRouter()

@router.get("/", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    """
    Fetch all notifications for the current logged-in user.
    Sorts by newest first.
    """
    notifs = await Notification.find(
        Notification.recipient_id == str(current_user.id)
    ).sort("-created_at").to_list()
    return notifs

@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, current_user: User = Depends(get_current_user)):
    """
    Mark a specific notification as read.
    """
    notif = await Notification.get(notif_id)
    if notif and notif.recipient_id == str(current_user.id):
        notif.is_read = True
        await notif.save()
    return {"status": "ok"}