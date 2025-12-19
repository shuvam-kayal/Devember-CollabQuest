from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.models import User, Skill, DayAvailability, Block
from app.auth.dependencies import get_current_user
from app.services.vector_store import generate_embedding 
from bson import ObjectId

router = APIRouter()

class ProfileUpdate(BaseModel):
    skills: List[str]
    interests: List[str]
    about: str
    availability: List[DayAvailability]
    is_looking_for_team: bool = True # <--- Added

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
    current_user.is_looking_for_team = data.is_looking_for_team # <--- Update status
    
    profile_text = f"{' '.join(data.skills)} {' '.join(data.interests)} {data.about}"
    print("🧠 Generating Vector Embedding...")
    current_user.embedding = generate_embedding(profile_text)
    
    await current_user.save()
    return current_user

class SkillsUpdate(BaseModel):
    skills: List[str]

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
    
    is_blocked = await Block.find_one(Block.blocker_id == user_id, Block.blocked_id == str(current_user.id))
    if is_blocked:
        raise HTTPException(status_code=403, detail="Profile Unavailable")

    try:
        user = await User.get(user_id)
        if not user: raise HTTPException(404, detail="User not found")
        return user
    except Exception as e: raise HTTPException(500, detail=str(e))