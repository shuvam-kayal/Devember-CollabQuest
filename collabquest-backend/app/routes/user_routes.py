from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.models import User, Skill, DayAvailability, TimeRange
from app.auth.dependencies import get_current_user
from app.services.ai_roadmap import expand_interests # <--- Import this
from bson import ObjectId

router = APIRouter()

# --- Updated Input Model ---
class ProfileUpdate(BaseModel):
    skills: List[str]
    interests: List[str]
    about: str
    availability: List[DayAvailability]

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=User)
async def update_profile(data: ProfileUpdate, current_user: User = Depends(get_current_user)):
    # 1. Update Standard Fields
    new_skills = [Skill(name=s, level="Intermediate") for s in data.skills]
    current_user.skills = new_skills
    current_user.interests = data.interests
    current_user.about = data.about
    current_user.availability = data.availability
    
    # 2. AI Magic: Expand Interests silently
    # We do this in background or await it (await is fine for profile save)
    print("🤖 AI Expanding interests...")
    current_user.expanded_interests = await expand_interests(data.interests)
    
    await current_user.save()
    return current_user

# ... (Keep get_user_details and update_skills for backward compatibility if needed) ...
class SkillsUpdate(BaseModel):
    skills: List[str]

@router.put("/skills", response_model=User)
async def update_skills_legacy(data: SkillsUpdate, current_user: User = Depends(get_current_user)):
    new_skills = [Skill(name=s, level="Intermediate") for s in data.skills]
    current_user.skills = new_skills
    await current_user.save()
    return current_user

@router.get("/{user_id}", response_model=User)
async def get_user_details(user_id: str, current_user: User = Depends(get_current_user)):
    if not ObjectId.is_valid(user_id): raise HTTPException(status_code=404, detail="Invalid ID")
    try:
        user = await User.get(user_id)
        if not user: raise HTTPException(404, detail="User not found")
        return user
    except Exception as e: raise HTTPException(500, detail=str(e))

