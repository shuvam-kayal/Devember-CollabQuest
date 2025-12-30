import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.models import ChatMessage, User

# 🔥 FIX: Import from the correct dependencies file
from app.auth.dependencies import get_current_user 

from app.services.chatbot_services import generate_chat_reply
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

# --- REQUEST MODELS ---
class ChatRequest(BaseModel):
    question: str
    task_type: Optional[str] = "auto" 

class ChatResponse(BaseModel):
    answer: str

# --- MAIN CHAT ENDPOINT ---
@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(data: ChatRequest, current_user: User = Depends(get_current_user)):
    """
    1. Extracts User Context.
    2. Calls AI Service.
    3. Saves history.
    """
    try:
        # 1. EXTRACT SKILLS SAFELY
        user_skills = []
        if current_user.skills:
            user_skills = [
                s.name if hasattr(s, 'name') else str(s) 
                for s in current_user.skills
            ]

        # 2. CALL AI SERVICE
        answer = await generate_chat_reply(
            question=data.question, 
            user_skills=user_skills, 
            user_id=str(current_user.id)
        )

        # 3. SAVE TO DB
        chat_message = ChatMessage(
            user_id=str(current_user.id),
            question=data.question,
            answer=answer
        )
        await chat_message.insert()

        return {"answer": answer}

    except Exception as e:
        print(f"❌ CRITICAL ERROR in /chat/ai/ask: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="The AI Brain is momentarily disconnected."
        )

# --- HISTORY ENDPOINT ---
@router.get("/history")
async def get_chat_history(current_user: User = Depends(get_current_user)):
    try:
        messages = await ChatMessage.find(
            ChatMessage.user_id == str(current_user.id)
        ).sort("-timestamp").limit(25).to_list()

        messages.reverse()

        history = [
            {
                "question": msg.question,
                "answer": msg.answer,
                "timestamp": msg.timestamp
            }
            for msg in messages
        ]

        return {"history": history}

    except Exception as e:
        print(f"Error fetching history: {e}")
        return {"history": []}