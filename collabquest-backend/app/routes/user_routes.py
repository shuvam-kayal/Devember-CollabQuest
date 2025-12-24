from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.models import User, Skill, DayAvailability, TimeRange, Block, Link, Achievement, ConnectedAccounts, Education, Team, VisibilitySettings
from app.auth.dependencies import get_current_user
from app.services.vector_store import generate_embedding
from app.auth.utils import fetch_codeforces_stats, fetch_leetcode_stats, update_trust_score
from bson import ObjectId
from datetime import datetime

router = APIRouter()

class ProfileUpdate(BaseModel):
    skills: List[str]
    interests: List[str]
    about: str
    availability: List[DayAvailability]
    is_looking_for_team: bool = True
    
    # New Fields
    age: Optional[str] = None
    education: List[Education] = []
    social_links: List[Link] = []
    professional_links: List[Link] = []
    achievements: List[Achievement] = []

class ConnectRequest(BaseModel):
    handle_or_url: str

class SkillsUpdate(BaseModel):
    skills: List[str]

class VisibilityUpdate(BaseModel):
    settings: VisibilitySettings

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# --- FAVORITES ---

@router.post("/favorites/{team_id}")
async def toggle_favorite(team_id: str, current_user: User = Depends(get_current_user)):
    if not team_id: raise HTTPException(400, "Invalid Team ID")
    
    if team_id in current_user.favorites:
        current_user.favorites.remove(team_id)
        status = "removed"
    else:
        current_user.favorites.append(team_id)
        status = "added"
        
    await current_user.save()
    return {"status": status, "favorites": current_user.favorites}

@router.get("/me/favorites_details", response_model=List[Team])
async def get_my_favorites(current_user: User = Depends(get_current_user)):
    """Fetches full team details for favorited projects"""
    if not current_user.favorites:
        return []
    
    # Filter out invalid IDs just in case
    valid_ids = [ObjectId(tid) for tid in current_user.favorites if ObjectId.is_valid(tid)]
    if not valid_ids:
        return []
        
    teams = await Team.find({"_id": {"$in": valid_ids}}).to_list()
    return teams

# --- DASHBOARD ENDPOINTS ---

@router.get("/me/tasks")
async def get_my_tasks(current_user: User = Depends(get_current_user)):
    """Fetches all tasks assigned to the current user across all projects."""
    teams = await Team.find(Team.members == str(current_user.id)).to_list()
    active_tasks = []
    history_tasks = []
    
    for team in teams:
        for task in team.tasks:
            if task.assignee_id == str(current_user.id):
                t_dict = task.dict()
                t_dict["project_id"] = str(team.id)
                t_dict["project_name"] = team.name
                
                if task.status == "completed":
                    history_tasks.append(t_dict)
                else:
                    active_tasks.append(t_dict)
                    
    active_tasks.sort(key=lambda x: x['deadline'])
    history_tasks.sort(key=lambda x: x['deadline'], reverse=True)
    
    return {"active": active_tasks, "history": history_tasks}

@router.get("/me/projects")
async def get_my_projects(current_user: User = Depends(get_current_user)):
    """Fetches all projects the user is a member of."""
    teams = await Team.find(Team.members == str(current_user.id)).to_list()
    return teams

# -----------------------------------

@router.put("/profile", response_model=User)
async def update_profile(data: ProfileUpdate, current_user: User = Depends(get_current_user)):
    new_skills = [Skill(name=s, level="Intermediate") for s in data.skills]
    current_user.skills = new_skills
    current_user.interests = data.interests
    current_user.about = data.about
    current_user.availability = data.availability
    current_user.is_looking_for_team = data.is_looking_for_team
    
    # Save New Fields
    current_user.age = data.age
    current_user.education = data.education
    current_user.social_links = data.social_links
    current_user.professional_links = data.professional_links
    current_user.achievements = data.achievements
    
    # Embedding generation
    achievements_text = " ".join([a.title for a in data.achievements])
    edu_text = " ".join([f"{e.course} at {e.institute}" for e in data.education if e.is_visible])
    profile_text = f"{' '.join(data.skills)} {' '.join(data.interests)} {data.about} {edu_text} {achievements_text}"
    current_user.embedding = generate_embedding(profile_text)
    
    # Recalculate trust score to ensure consistency (e.g. if linkedIn score was wrong)
    await update_trust_score(current_user)
    
    await current_user.save()
    return current_user

@router.put("/visibility", response_model=User)
async def update_visibility(data: VisibilityUpdate, current_user: User = Depends(get_current_user)):
    current_user.visibility_settings = data.settings
    await current_user.save()
    return current_user

@router.post("/connect/{platform}")
async def connect_platform(platform: str, req: ConnectRequest, current_user: User = Depends(get_current_user)):
    """
    Connects external platforms, verifies them by fetching data, and boosts trust score.
    """
    platform = platform.lower()
    stats_data = {}

    if platform == "linkedin":
        if "linkedin.com/in/" not in req.handle_or_url:
            raise HTTPException(400, "Invalid LinkedIn Profile URL")
        current_user.connected_accounts.linkedin = req.handle_or_url
        stats_data = {"url": req.handle_or_url, "verified": True}
        
    elif platform == "codeforces":
        stats = await fetch_codeforces_stats(req.handle_or_url)
        if not stats:
            raise HTTPException(404, "Codeforces handle not found")
        current_user.connected_accounts.codeforces = req.handle_or_url
        stats_data = {
            "handle": req.handle_or_url,
            "rating": stats.get("rating", "Unrated"),
            "rank": stats.get("rank", "Newbie"),
            "maxRating": stats.get("maxRating", 0)
        }
        
    elif platform == "leetcode":
        stats = await fetch_leetcode_stats(req.handle_or_url)
        if not stats:
            raise HTTPException(404, "LeetCode user not found")
        
        total_solved = 0
        if "submitStats" in stats:
            ac_submissions = stats.get("submitStats", {}).get("acSubmissionNum", [])
            for item in ac_submissions:
                if item["difficulty"] == "All":
                    total_solved = item["count"]

        current_user.connected_accounts.leetcode = req.handle_or_url
        stats_data = {
            "username": req.handle_or_url,
            "total_solved": total_solved
        }
    
    else:
        raise HTTPException(400, "Invalid platform")

    if not current_user.platform_stats:
        current_user.platform_stats = {}
    current_user.platform_stats[platform] = stats_data

    await update_trust_score(current_user)
    await current_user.save()
        
    return {
        "status": "connected", 
        "trust_score": current_user.trust_score, 
        "breakdown": current_user.trust_score_breakdown,
        "account": req.handle_or_url,
        "stats": stats_data
    }

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