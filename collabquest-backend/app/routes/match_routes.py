from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.models import User, Team, Swipe, Match, Notification
from app.auth.dependencies import get_current_user
from app.services.matching_service import calculate_project_match, calculate_user_compatibility
import traceback

router = APIRouter()

# --- Input/Output Models ---
class SwipeRequest(BaseModel):
    target_id: str
    direction: str 
    type: str      
    related_id: Optional[str] = None # Project ID context

class MatchResponse(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    contact: str | None = None
    role: str
    project_id: str
    project_name: str

# --- Helper ---
async def create_match(user_id: str, project_id: str, leader_id: str):
    existing = await Match.find_one(
        Match.user_id == user_id, 
        Match.project_id == project_id
    )
    if existing: return

    await Match(user_id=user_id, project_id=project_id, leader_id=leader_id).insert()
    
    # Notify User (Candidate) - "You connected!"
    project = await Team.get(project_id)
    p_name = project.name if project else "a project"
    
    await Notification(
        recipient_id=user_id, sender_id=leader_id, 
        message=f"New Connection! You matched with {p_name}.", type="match", related_id=project_id
    ).insert()
    
    # Notify Leader - "New Connection!"
    candidate = await User.get(user_id)
    name = candidate.username if candidate else "A new member"
    
    await Notification(
        recipient_id=leader_id, sender_id=user_id, 
        message=f"New Connection! {name} matched with {p_name}.", type="match", related_id=project_id
    ).insert()

# --- Routes ---

@router.get("/projects")
async def match_projects_for_user(current_user: User = Depends(get_current_user)):
    all_teams = await Team.find_all().to_list()
    candidates = [t for t in all_teams if str(current_user.id) not in t.members]
    
    scored_projects = []
    for team in candidates:
        score = calculate_project_match(current_user, team)
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
    all_users = await User.find_all().to_list()
    
    exclude_ids = {str(current_user.id)}
    
    if project_id:
        target_project = await Team.get(project_id)
        if target_project:
            for member_id in target_project.members:
                exclude_ids.add(member_id)
    else:
        my_teams = await Team.find(Team.members == str(current_user.id)).to_list()
        for team in my_teams:
            for member_id in team.members:
                exclude_ids.add(member_id)

    candidates = [u for u in all_users if str(u.id) not in exclude_ids]

    scored_users = []
    for candidate in candidates:
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
        # Validate ID string
        if data.target_id == "[object Object]" or not data.target_id:
            raise HTTPException(status_code=400, detail="Invalid Target ID")

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
                    {"$or": [{"related_id": str(project.id)}, {"related_id": None}]}
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
                # Specific project context
                reverse_swipe = await Swipe.find_one(
                    Swipe.swiper_id == target_user_id,
                    Swipe.target_id == target_project_id,
                    Swipe.direction == "right"
                )
                if reverse_swipe:
                    is_match = True
                    await create_match(target_user_id, target_project_id, str(current_user.id))
                else:
                    # FIX: Send LIKE notification, NOT Invite
                    proj = await Team.get(target_project_id)
                    p_name = proj.name if proj else "a project"
                    await Notification(
                        recipient_id=target_user_id, sender_id=str(current_user.id),
                        message=f"A Team Leader ({current_user.username}) is interested in you for {p_name}!",
                        type="like", related_id=target_project_id
                    ).insert()
            else:
                # Legacy (Global context)
                my_projects = await Team.find(Team.members == str(current_user.id)).to_list()
                for project in my_projects:
                    reverse_swipe = await Swipe.find_one(Swipe.swiper_id == target_user_id, Swipe.target_id == str(project.id), Swipe.direction == "right")
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
                "project_name": project.name
            })

    for m in matches_as_leader:
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
                "project_name": project.name
            })
            
    return results