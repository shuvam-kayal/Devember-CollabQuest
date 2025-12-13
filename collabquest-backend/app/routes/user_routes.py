from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pydantic import BaseModel
from app.models import User, Skill
from app.auth.dependencies import get_current_user
from bson import ObjectId # <--- Import ObjectId to check validity

router = APIRouter()

class SkillsUpdate(BaseModel):
    skills: List[str] 

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/skills", response_model=User)
async def update_skills(data: SkillsUpdate, current_user: User = Depends(get_current_user)):
    new_skills = [Skill(name=s, level="Intermediate") for s in data.skills]
    current_user.skills = new_skills
    await current_user.save()
    return current_user

# --- ROBUST GET USER ENDPOINT ---
@router.get("/{user_id}", response_model=User)
async def get_user_details(user_id: str, current_user: User = Depends(get_current_user)):
    """
    Fetch a specific user's public info by ID.
    """
    print(f"🔎 Fetching user details for ID: {user_id}") # Debug Log

    # 1. Validate ID Format BEFORE Database Call
    if not ObjectId.is_valid(user_id):
        print(f"❌ Invalid Object ID format: {user_id}")
        raise HTTPException(status_code=404, detail="Invalid User ID format")

    try:
        # 2. Database Call
        user = await User.get(user_id)
        if not user:
            print(f"❌ User not found in DB")
            raise HTTPException(status_code=404, detail="User not found")
        
        return user

    except Exception as e:
        print(f"🔥 CRITICAL ERROR fetching user: {e}")
        # Return 500 but don't crash the server connection
        raise HTTPException(status_code=500, detail=str(e))