from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.models import User, Team, Swipe, Match, Notification, Block
from app.auth.dependencies import get_current_user
from app.routes.chat_routes import manager
from app.services.matching_service import calculate_project_match, calculate_user_compatibility, calculate_match_score
from beanie.operators import Or
import traceback
import random

router = APIRouter()

class SwipeRequest(BaseModel):
    target_id: str
    direction: str 
    type: str 
    related_id: Optional[str] = None
    message: Optional[str] = None

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

async def create_match(user_id: str, project_id: str, leader_id: str):
    existing = await Match.find_one(Match.user_id == user_id, Match.project_id == project_id)
    if existing: return True

    # 1. Fetch the project to get the name
    project = await Team.get(project_id)
    project_name = project.name if project else "a project"

    await Match(user_id=user_id, project_id=project_id, leader_id=leader_id).insert()
    
    try:
        # 2. Assign the notification to 'n1' so we can access its ID for the socket message
        n1 = await Notification(
            recipient_id=user_id, 
            sender_id=leader_id, 
            message=f"You matched with {project_name}! View your My projects tab to take action!", 
            type="match", 
            related_id=project_id
        ).insert()
        
        # 3. Send Real-Time Message to Candidate
        await manager.send_personal_message({
            "event": "notification",
            "notification": {
                "_id": str(n1.id), 
                "message": n1.message, 
                "type": "match", 
                "is_read": False, 
                "related_id": project_id
            }
        }, user_id)
        
        candidate = await User.get(user_id)
        c_name = candidate.username if candidate else "Someone"
        
        # 4. Assign the notification to 'n2' for the leader
        n2 = await Notification(
            recipient_id=leader_id, 
            sender_id=user_id, 
            message=f"{c_name} matched with your project {project_name}! Check your Project details page to take action!", 
            type="match", 
            related_id=project_id
        ).insert()

        # 5. Send Real-Time Message to Leader
        await manager.send_personal_message({
            "event": "notification",
            "notification": {
                "_id": str(n2.id), 
                "message": n2.message, 
                "type": "match", 
                "is_read": False, 
                "related_id": project_id
            }
        }, leader_id)

    except Exception as e:
        print(f"Match Notification Error: {e}")
        pass
    return True

@router.get("/projects")
async def match_projects_for_user(
    current_user: User = Depends(get_current_user),
    search: Optional[str] = None,
    skills: Optional[List[str]] = Query(None),
    min_members: Optional[int] = None,
    max_members: Optional[int] = None,
    recruiting_only: bool = True
):
    my_id = str(current_user.id)
    # Fetch Blocked List
    blocks = await Block.find({"$or": [{"blocker_id": my_id}, {"blocked_id": my_id}]}).to_list()
    blocked_ids = set([b.blocked_id if b.blocker_id == my_id else b.blocker_id for b in blocks])

    all_teams = await Team.find_all().to_list()
    candidates = []
    search_lower = search.lower() if search else None
    
    for t in all_teams:
        if str(current_user.id) in t.members: continue
        # Filter blocked leaders
        if t.leader_id in blocked_ids: continue
        
        if recruiting_only and not t.is_looking_for_members: continue
        if search_lower and search_lower not in t.name.lower(): continue
        if min_members is not None and len(t.members) < min_members: continue
        if max_members is not None and len(t.members) > max_members: continue
        if skills:
            team_skills = set(s.lower() for s in (t.needed_skills + t.active_needed_skills))
            req_skills = set(s.lower() for s in skills)
            if not team_skills.intersection(req_skills): continue
        candidates.append(t)
    
    scored_projects = []
    for team in candidates:
        member_objects = []
        for m_id in team.members:
            user = await User.get(m_id)
            if user: member_objects.append(user)
        
        score = await calculate_match_score(current_user, team, member_objects)
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
    search: Optional[str] = None,
    skills: Optional[List[str]] = Query(None),
    interests: Optional[List[str]] = Query(None),
    randomize: bool = False,
    current_user: User = Depends(get_current_user)
):
    my_id = str(current_user.id)
    # Fetch Blocked List
    blocks = await Block.find({"$or": [{"blocker_id": my_id}, {"blocked_id": my_id}]}).to_list()
    blocked_ids = set([b.blocked_id if b.blocker_id == my_id else b.blocker_id for b in blocks])

    all_users = await User.find_all().to_list()
    exclude_ids = {my_id}
    
    target_project = None
    existing_members_objects = []

    if project_id:
        target_project = await Team.get(project_id)
        if target_project:
            for member_id in target_project.members:
                exclude_ids.add(member_id)
                m_user = await User.get(member_id)
                if m_user: existing_members_objects.append(m_user)
    else:
        my_teams = await Team.find(Team.members == my_id).to_list()
        for team in my_teams:
            for member_id in team.members:
                exclude_ids.add(member_id)

    candidates = []
    search_lower = search.lower() if search else None
    
    for u in all_users:
        if str(u.id) in exclude_ids: continue
        if str(u.id) in blocked_ids: continue # Exclude blocked users
        if not u.is_looking_for_team: continue
        if search_lower and search_lower not in u.username.lower(): continue
        if skills:
            user_skills = set(s.name.lower() for s in u.skills)
            req_skills = set(s.lower() for s in skills)
            if not user_skills.intersection(req_skills): continue
        if interests:
            user_interests = set(i.lower() for i in u.interests)
            req_interests = set(i.lower() for i in interests)
            if not user_interests.intersection(req_interests): continue
        candidates.append(u)

    scored_users = []
    for candidate in candidates:
        if target_project:
            score = await calculate_match_score(candidate, target_project, existing_members_objects)
        else:
            score = await calculate_user_compatibility(current_user, candidate)

        user_dict = candidate.dict()
        user_dict["id"] = str(candidate.id)
        user_dict["_id"] = str(candidate.id)
        user_dict["match_score"] = score
        scored_users.append(user_dict)
            
    if randomize:
        random.shuffle(scored_users)
    else:
        scored_users.sort(key=lambda x: x["match_score"], reverse=True)
        
    return scored_users


@router.post("/swipe")
async def handle_swipe(data: SwipeRequest, current_user: User = Depends(get_current_user)):
    try:
        if not data.target_id or data.target_id == "[object Object]":
            return {"status": "error", "message": "Invalid ID"}

        # --- 1. Record the Swipe ---
        last_swipe = await Swipe.find(
            Swipe.swiper_id == str(current_user.id), 
            Swipe.target_id == data.target_id
        ).sort("-timestamp").first_or_none()
        
        should_proceed = True
        
        if last_swipe:
            time_diff = datetime.now() - last_swipe.timestamp
            if time_diff < timedelta(days=3):
                should_proceed = False
                # Repair logic for missing notifications (optional)
                if data.type == "user": 
                    # ... (your existing repair logic) ...
                    should_proceed = True 

            if not should_proceed:
                 return {"status": "cooldown", "message": "You already liked this recently."}

        # Check for Immediate Match (Race condition handle)
        if last_swipe and last_swipe.direction == "right" and data.direction == "right":
             if data.type == "project":
                project = await Team.get(data.target_id)
                if project and project.members:
                    leader_id = project.members[0]
                    reverse = await Swipe.find_one(Swipe.swiper_id == leader_id, Swipe.target_id == str(current_user.id), Swipe.direction == "right")
                    if reverse:
                        await create_match(str(current_user.id), str(project.id), leader_id)
                        return {"status": "liked", "is_match": True}
        
        if not last_swipe:
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
        
        # --- 2. Handle Project Swipe (User likes Project) ---
        if data.type == "project":
            project = await Team.get(data.target_id)
            if project and project.members:
                leader_id = project.members[0]
                
                # Check for reverse swipe (Match)
                reverse_swipe = await Swipe.find_one(Swipe.swiper_id == leader_id, Swipe.target_id == str(current_user.id), Swipe.direction == "right")
                
                if reverse_swipe:
                    is_match = True
                    await create_match(str(current_user.id), str(project.id), leader_id)
                else:
                    # ✅ FIX: Send 'project_like' info notification instead of 'join_request'
                    try:
                        # 1. Deduplicate: Don't spam the leader if they already requested
                        exists = await Notification.find_one(
                            Notification.recipient_id == leader_id,
                            Notification.sender_id == str(current_user.id),
                            Notification.type == "project_like", 
                            Notification.related_id == str(project.id)
                        )
                        
                        if not exists:
                            # 2. Create the Notification with the correct TYPE
                            notif = await Notification(
                                recipient_id=leader_id, 
                                sender_id=str(current_user.id),  # Matches your model
                                related_id=str(project.id),      # Matches your model (Team ID)
                                type="project_like",             
                                message=data.message or f"{current_user.username} liked your project {project.name}", 
                                is_read=False,
                                action_status="pending"
                            ).insert()
                            await manager.send_personal_message({
                                "event": "notification",
                                "notification": {
                                    "id": str(notif.id),
                                    "message": notif.message,
                                    "type": notif.type,
                                    "sender_id": notif.sender_id,
                                    "related_id": notif.related_id,
                                    "is_read": False,
                                    "data": { # Enrich for Frontend
                                        "candidate_name": current_user.username,
                                        "candidate_avatar": current_user.avatar_url,
                                        "project_name": project.name
                                    }
                                }
                            }, leader_id)
                            print(f"✅ Project Like sent to {leader_id}")
                    except Exception as e: 
                        print(f"❌ Notification Failed: {e}")
                        pass

        # --- 3. Handle User Swipe (Leader likes Candidate) ---
        elif data.type == "user":
            target_user_id = data.target_id
            target_project_id = data.related_id 
            
            if target_project_id:
                reverse_swipe = await Swipe.find_one(Swipe.swiper_id == target_user_id, Swipe.target_id == target_project_id, Swipe.direction == "right")
                
                if reverse_swipe:
                    is_match = True
                    await create_match(target_user_id, target_project_id, str(current_user.id))
                else:
                    # ✅ FIXED: Send 'team_invite' instead of 'like'
                    try:
                        p_name = "a project"
                        try:
                            proj = await Team.get(target_project_id)
                            if proj: p_name = proj.name
                        except: pass

                        exists = await Notification.find_one(
                            Notification.recipient_id == target_user_id,
                            Notification.sender_id == str(current_user.id),
                            Notification.type == "candidate_like", 
                            Notification.related_id == str(target_project_id)
                        )
                        if not exists:
                            notif = await Notification(
                                recipient_id=target_user_id, 
                                sender_id=str(current_user.id), 
                                message=f"A Team Leader is interested in you for {p_name}!", 
                                type="candidate_like", 
                                related_id=str(target_project_id),
                                is_read=False
                            ).insert()
                            await manager.send_personal_message({
                                "event": "notification",
                                "notification": {
                                    "id": str(notif.id),
                                    "message": notif.message,
                                    "type": notif.type,
                                    "sender_id": notif.sender_id,
                                    "related_id": notif.related_id,
                                    "is_read": False,
                                    "data": { # Enrich
                                        "candidate_name": current_user.username,
                                        "candidate_avatar": current_user.avatar_url,
                                        "project_name": p_name
                                    }
                                }
                            }, target_user_id)
                    except Exception as e:
                        print(f"❌ Notification Error: {e}")
            else:
                # Fallback Logic (omitted for brevity, keep your existing logic here)
                pass

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
                results.append({"id": str(leader.id), "name": leader.username, "avatar": leader.avatar_url or "https://github.com/shadcn.png", "contact": leader.email, "role": "Team Leader", "project_id": str(project.id), "project_name": project.name, "status": m.status, "rejected_by": m.rejected_by})
        except: continue
    for m in matches_as_leader:
        try:
            candidate = await User.get(m.user_id)
            project = await Team.get(m.project_id)
            if candidate and project:
                results.append({"id": str(candidate.id), "name": candidate.username, "avatar": candidate.avatar_url or "https://github.com/shadcn.png", "contact": candidate.email, "role": "Teammate", "project_id": str(project.id), "project_name": project.name, "status": m.status, "rejected_by": m.rejected_by})
        except: continue
    return results

@router.get("/team/{team_id}", response_model=List[MatchResponse])
async def get_team_matches(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, "Team not found")
    if str(current_user.id) != team.members[0]: raise HTTPException(403, "Only the Team Leader can view candidates")
    matches = await Match.find(Match.project_id == team_id, Match.leader_id == str(current_user.id)).to_list()
    results = []
    for m in matches:
        candidate = await User.get(m.user_id)
        if candidate:
            results.append({"id": str(candidate.id), "name": candidate.username, "avatar": candidate.avatar_url or "https://github.com/shadcn.png", "contact": candidate.email, "role": "Teammate", "project_id": str(team.id), "project_name": team.name, "status": m.status, "rejected_by": m.rejected_by})
    return results

@router.delete("/delete/{project_id}/{user_id}")
async def delete_match_entry(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    await Match.find(Match.project_id == project_id, Match.user_id == user_id).delete()
    await Swipe.find(Swipe.swiper_id == user_id, Swipe.target_id == project_id).delete()
    team = await Team.get(project_id)
    if team and team.members:
        leader_id = team.members[0]
        await Swipe.find(Swipe.swiper_id == leader_id, Swipe.target_id == user_id, Swipe.direction == "right").delete()
    return {"status": "deleted"}