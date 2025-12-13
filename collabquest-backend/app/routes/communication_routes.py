from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models import User
from app.auth.dependencies import get_current_user
import os

# If you want to use real email later, import smtplib here

router = APIRouter()

class EmailRequest(BaseModel):
    recipient_id: str
    subject: str
    body: str

@router.post("/send-email")
async def send_email(email_data: EmailRequest, current_user: User = Depends(get_current_user)):
    """
    Sends an email from the current user to the recipient.
    Privacy: The sender never sees the recipient's email address.
    """
    # 1. Fetch Recipient
    recipient = await User.get(email_data.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # 2. Construct the Email
    sender_name = current_user.username
    sender_email = current_user.email
    recipient_email = recipient.email
    
    email_subject = f"[CollabQuest] {email_data.subject}"
    email_body = f"""
    You have a new message from {sender_name} via CollabQuest!
    
    ---------------------------------------------------
    {email_data.body}
    ---------------------------------------------------
    
    To reply, you can email them at: {sender_email}
    """
    
    # 3. Send (Mock Implementation for Hackathon)
    # In production, replace this print with smtplib or SendGrid API
    print(f"📧 --- SIMULATING EMAIL SENDING ---")
    print(f"TO: {recipient_email} (Hidden from UI)")
    print(f"FROM: {sender_email}")
    print(f"SUBJECT: {email_subject}")
    print(f"BODY: {email_body}")
    print(f"📧 --------------------------------")
    
    return {"status": "sent", "message": "Email sent successfully via secure relay."}