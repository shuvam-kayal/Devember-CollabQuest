from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.models import User, Team, Swipe, Match, Notification
from app.auth.dependencies import get_current_user
from app.services.matching_service import calculate_match_score, calculate_user_compatibility, calculate_project_match
from beanie.operators import Or
import traceback

router = APIRouter()

# --- Models ---
class SwipeRequest(BaseModel):
    target_id: str
    direction: str 
    type: str 
    related_id: Optional[str] = None

class MatchResponse(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    contact: str | None = None
    role: str
    project_id: str
    project_name: str
    status: str
    rejected_by: Optional[str] = None

# --- Helper ---
async def create_match(user_id: str, project_id: str, leader_id: str):
    existing = await Match.find_one(Match.user_id == user_id, Match.project_id == project_id)
    if existing: return

    await Match(user_id=user_id, project_id=project_id, leader_id=leader_id).insert()
    
    # Notify User
    try:
        project = await Team.get(project_id)
        p_name = project.name if project else "a project"
        await Notification(
            recipient_id=user_id, sender_id=leader_id, 
            message=f"You matched with {p_name}!", type="match", related_id=project_id
        ).insert()
        
        candidate = await User.get(user_id)
        c_name = candidate.username if candidate else "Someone"
        
        await Notification(
            recipient_id=leader_id, sender_id=user_id, 
            message=f"{c_name} matched with your project!", type="match", related_id=project_id
        ).insert()
    except: pass

# --- Routes ---

@router.get("/projects")
async def match_projects_for_user(current_user: User = Depends(get_current_user)):
    """Find projects for the candidate"""
    all_teams = await Team.find_all().to_list()
    # Filter: Show projects I am NOT in
    candidates = [t for t in all_teams if str(current_user.id) not in t.members]
    
    scored_projects = []
    for team in candidates:
        # Fetch members for advanced scoring
        members = []
        for mid in team.members:
            u = await User.get(mid)
            if u: members.append(u)
            
        score = await calculate_match_score(current_user, team, members)
        
        team_dict = team.dict()
        team_dict["id"] = str(team.id)
        team_dict["_id"] = str(team.id)
        team_dict["match_score"] = score
        scored_projects.append(team_dict)
            
    scored_projects.sort(key=lambda x: x["match_score"], reverse=True)
    return scored_projects

@router.get("/users")
async def match_teammates_for_user(
    project_id: Optional[str] = None, 
    current_user: User = Depends(get_current_user)
):
    """Find teammates for the leader (optionally for a specific project)"""
    all_users = await User.find_all().to_list()
    exclude_ids = {str(current_user.id)}
    
    target_project = None
    if project_id:
        target_project = await Team.get(project_id)
        if target_project:
            for member_id in target_project.members:
                exclude_ids.add(member_id)
    else:
        # Legacy/General mode: Exclude members of ALL my teams
        my_teams = await Team.find(Team.members == str(current_user.id)).to_list()
        for t in my_teams:
            for m_id in t.members:
                exclude_ids.add(m_id)

    candidates = [u for u in all_users if str(u.id) not in exclude_ids]

    scored_users = []
    for candidate in candidates:
        if target_project:
            # Score Candidate vs Project
             members = []
             for mid in target_project.members:
                 u = await User.get(mid)
                 if u: members.append(u)
             score = await calculate_match_score(candidate, target_project, members)
        else:
             # Legacy User-User Score
             score = calculate_user_compatibility(current_user, candidate)
        
        user_dict = candidate.dict()
        user_dict["id"] = str(candidate.id)
        user_dict["_id"] = str(candidate.id)
        user_dict["match_score"] = score
        scored_users.append(user_dict)
            
    scored_users.sort(key=lambda x: x["match_score"], reverse=True)
    return scored_users

@router.post("/swipe")
async def handle_swipe(data: SwipeRequest, current_user: User = Depends(get_current_user)):
    try:
        # Validate ID
        if not data.target_id or data.target_id == "[object Object]":
            raise HTTPException(status_code=400, detail="Invalid Target ID")

        # --- 3-DAY COOLDOWN CHECK ---
        last_swipe = await Swipe.find(
            Swipe.swiper_id == str(current_user.id),
            Swipe.target_id == data.target_id
        ).sort("-timestamp").first_or_none()

        if last_swipe:
            time_diff = datetime.now() - last_swipe.timestamp
            if time_diff < timedelta(days=3):
                 return {"status": "cooldown", "message": "You already liked this recently."}

        # Record Swipe
        await Swipe(
            swiper_id=str(current_user.id),
            target_id=data.target_id,
            direction=data.direction,
            type=data.type,
            related_id=data.related_id
        ).insert()
        
        if data.direction == "left":
            return {"status": "passed", "is_match": False}

        is_match = False
        
        # CASE A: User swipes Project
        if data.type == "project":
            project = await Team.get(data.target_id)
            if project and project.members:
                leader_id = project.members[0]
                
                reverse_swipe = await Swipe.find_one(
                    Swipe.swiper_id == leader_id,
                    Swipe.target_id == str(current_user.id),
                    Swipe.direction == "right",
                    Or(Swipe.related_id == str(project.id), Swipe.related_id == None)
                )
                
                if reverse_swipe:
                    is_match = True
                    await create_match(str(current_user.id), str(project.id), leader_id)
                else:
                    await Notification(
                        recipient_id=leader_id, sender_id=str(current_user.id),
                        message=f"{current_user.username} liked your project {project.name}",
                        type="like", related_id=str(project.id)
                    ).insert()

        # CASE B: Leader swipes User
        elif data.type == "user":
            target_user_id = data.target_id
            target_project_id = data.related_id 
            
            if target_project_id:
                reverse_swipe = await Swipe.find_one(
                    Swipe.swiper_id == target_user_id,
                    Swipe.target_id == target_project_id,
                    Swipe.direction == "right"
                )
                if reverse_swipe:
                    is_match = True
                    await create_match(target_user_id, target_project_id, str(current_user.id))
                else:
                    proj = await Team.get(target_project_id)
                    p_name = proj.name if proj else "a project"
                    await Notification(
                        recipient_id=target_user_id, sender_id=str(current_user.id),
                        message=f"A Team Leader ({current_user.username}) is interested in you for {p_name}!",
                        type="like", related_id=target_project_id
                    ).insert()
            else:
                # Global/Legacy Swipe
                my_projects = await Team.find(Team.members == str(current_user.id)).to_list()
                for project in my_projects:
                    reverse_swipe = await Swipe.find_one(
                        Swipe.swiper_id == target_user_id, 
                        Swipe.target_id == str(project.id), 
                        Swipe.direction == "right"
                    )
                    if reverse_swipe:
                        is_match = True
                        await create_match(target_user_id, str(project.id), str(current_user.id))
                        break

        return {"status": "liked", "is_match": is_match}

    except Exception as e:
        print(f"❌ SWIPE ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Server Error")

@router.get("/mine", response_model=List[MatchResponse])
async def get_my_matches(current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    matches_as_candidate = await Match.find(Match.user_id == uid).to_list()
    matches_as_leader = await Match.find(Match.leader_id == uid).to_list()
    
    results = []
    
    for m in matches_as_candidate:
        try:
            leader = await User.get(m.leader_id)
            project = await Team.get(m.project_id)
            if leader and project:
                results.append({
                    "id": str(leader.id),
                    "name": leader.username,
                    "avatar": leader.avatar_url or "https://github.com/shadcn.png",
                    "contact": leader.email,
                    "role": "Team Leader",
                    "project_id": str(project.id),
                    "project_name": project.name,
                    "status": m.status,
                    "rejected_by": m.rejected_by # <--- Return this for UI
                })
        except: continue

    for m in matches_as_leader:
        try:
            candidate = await User.get(m.user_id)
            project = await Team.get(m.project_id)
            if candidate and project:
                results.append({
                    "id": str(candidate.id),
                    "name": candidate.username,
                    "avatar": candidate.avatar_url or "https://github.com/shadcn.png",
                    "contact": candidate.email,
                    "role": "Teammate",
                    "project_id": str(project.id),
                    "project_name": project.name,
                    "status": m.status,
                    "rejected_by": m.rejected_by # <--- Return this for UI
                })
        except: continue
            
    return results