from fastapi import APIRouter, Depends
from app.models import User
from app.auth.dependencies import get_current_user
from pydantic import BaseModel
from typing import List
from app.models import Skill

router = APIRouter()

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Fetch the currently logged-in user's profile.
    This is protected - you MUST have a valid token to access it.
    """
    return current_user

class SkillsUpdate(BaseModel):
    skills: List[str] # ["Python", "React"]

@router.put("/skills")
async def update_skills(data: SkillsUpdate, current_user: User = Depends(get_current_user)):
    """Allow user to manually set their skills"""
    # Convert strings to Skill objects
    skill_objects = [Skill(name=s, level="Intermediate") for s in data.skills]
    current_user.skills = skill_objects
    await current_user.save()
    return current_user