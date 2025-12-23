from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from app.models import User
from app.auth.dependencies import get_current_user
import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

router = APIRouter()

# --- EMAIL CONFIGURATION ---
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

class EmailRequest(BaseModel):
    recipient_id: str
    subject: str
    body: str

@router.post("/send-email")
async def send_email(
    email_data: EmailRequest, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Sends an email from the current user to the recipient.
    Privacy: The sender never sees the recipient's email address.
    """
    # 1. Fetch Recipient
    recipient = await User.get(email_data.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # 2. Construct the Email Content
    sender_name = current_user.username
    sender_email = current_user.email
    recipient_email = recipient.email
    
    email_subject = f"[CollabQuest] {email_data.subject}"
    
    # Preserve newlines by replacing \n with <br>
    formatted_body = email_data.body.replace("\n", "<br>")
    
    # Link to the sender's profile (Assuming frontend runs on localhost:3000)
    profile_url = f"http://localhost:3000/profile/{current_user.id}"

    # HTML Body
    html_body = f"""
    <h3>You have a new message from {sender_name} via CollabQuest!</h3>
    <p><strong>Subject:</strong> {email_data.subject}</p>
    <hr>
    <p>{formatted_body}</p>
    <hr>
    <p>To reply, please visit their profile directly:</p>
    <p><a href="{profile_url}" style="background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Profile & Reply</a></p>
    <p style="font-size: 12px; color: gray; margin-top: 20px;">For privacy, the email address has not been revealed.</p>
    """

    message = MessageSchema(
        subject=email_subject,
        recipients=[recipient_email], 
        body=html_body,
        subtype=MessageType.html
    )

    # 3. Send Email
    fm = FastMail(conf)
    background_tasks.add_task(fm.send_message, message)
    
    return {"status": "sent", "message": "Email has been queued for sending."}