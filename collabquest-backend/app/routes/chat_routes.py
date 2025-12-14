from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import List, Optional, Dict
from pydantic import BaseModel
from app.models import Message, User, ChatGroup, Team, Match
from app.auth.dependencies import get_current_user
from beanie.operators import Or, In
import traceback

router = APIRouter()

# --- Input Models ---
class GroupCreate(BaseModel):
    name: str
    member_ids: List[str]
    team_id: Optional[str] = None

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class AddMemberRequest(BaseModel):
    user_id: str

# --- WebSocket Manager (Keep as is) ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    def disconnect(self, user_id: str):
        if user_id in self.active_connections: del self.active_connections[user_id]
    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

# --- ROUTES ---

# 1. Get Group Details (with Members)
@router.get("/groups/{group_id}")
async def get_group_details(group_id: str, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    
    # Enrich Member Data
    members_data = []
    for uid in group.members:
        u = await User.get(uid)
        if u:
            members_data.append({
                "id": str(u.id),
                "username": u.username,
                "avatar_url": u.avatar_url or "https://github.com/shadcn.png"
            })
            
    return {
        "id": str(group.id),
        "name": group.name,
        "avatar_url": group.avatar_url or f"https://api.dicebear.com/7.x/initials/svg?seed={group.name}",
        "admin_id": group.admin_id,
        "is_team_group": group.is_team_group,
        "members": members_data
    }

# 2. Update Group (Name/Avatar)
@router.put("/groups/{group_id}")
async def update_group(group_id: str, data: GroupUpdate, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    
    # Allow any member to rename? Or just Admin? Let's say Admin.
    if group.admin_id != str(current_user.id):
        raise HTTPException(403, "Only admin can edit group info")
        
    if data.name: group.name = data.name
    if data.avatar_url: group.avatar_url = data.avatar_url
    await group.save()
    return group

# 3. Remove Member
@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(group_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    
    if group.admin_id != str(current_user.id):
        raise HTTPException(403, "Only admin can remove members")
        
    if user_id == group.admin_id:
        raise HTTPException(400, "Admin cannot be removed")

    if user_id in group.members:
        group.members.remove(user_id)
        await group.save()
        
    return group

# ... (Keep existing routes: create_group, create_team_group, add_group_member, get_contacts, get_conversations, get_chat_history, unread-count, websocket) ...

@router.post("/groups")
async def create_group(data: GroupCreate, current_user: User = Depends(get_current_user)):
    if str(current_user.id) not in data.member_ids:
        data.member_ids.append(str(current_user.id))
    group = ChatGroup(name=data.name, admin_id=str(current_user.id), members=data.member_ids, team_id=data.team_id, is_team_group=bool(data.team_id))
    await group.insert()
    return group

@router.put("/groups/{group_id}/members")
async def add_group_member(group_id: str, req: AddMemberRequest, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    if group.admin_id != str(current_user.id): raise HTTPException(403, "Only admin can manage members")
    if req.user_id not in group.members:
        group.members.append(req.user_id)
        await group.save()
    return group

@router.post("/groups/team/{team_id}")
async def create_team_group(team_id: str, current_user: User = Depends(get_current_user)):
    team = await Team.get(team_id)
    if not team: raise HTTPException(404, detail="Team not found")
    if str(current_user.id) != team.members[0]: raise HTTPException(403, detail="Only Leader can create")
    existing = await ChatGroup.find_one(ChatGroup.team_id == team_id)
    if existing: return existing
    group = ChatGroup(name=f"{team.name} (Team)", admin_id=str(current_user.id), members=team.members, team_id=team_id, is_team_group=True)
    await group.insert()
    return group

@router.get("/contacts")
async def get_contacts(current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    known_ids = set()
    matches = await Match.find(Or(Match.user_id == uid, Match.leader_id == uid)).to_list()
    for m in matches: known_ids.add(m.user_id if m.leader_id == uid else m.leader_id)
    my_teams = await Team.find(Team.members == uid).to_list()
    for t in my_teams:
        for m_id in t.members:
            if m_id != uid: known_ids.add(m_id)
    contacts = []
    for pid in known_ids:
        user = await User.get(pid)
        if user: contacts.append({"id": str(user.id), "username": user.username, "avatar_url": user.avatar_url or "https://github.com/shadcn.png"})
    return contacts

@router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    try:
        uid = str(current_user.id)
        results = []
        messages = await Message.find(Or(Message.sender_id == uid, Message.recipient_id == uid)).sort("-timestamp").to_list()
        partners_map = {}
        my_groups = await ChatGroup.find(In(ChatGroup.members, [uid])).to_list()
        group_ids = [str(g.id) for g in my_groups]

        for m in messages:
            partner_id = m.sender_id if m.sender_id != uid else m.recipient_id
            if partner_id in group_ids or m.recipient_id in group_ids: continue
            if partner_id not in partners_map: partners_map[partner_id] = { "last_msg": m, "unread": 0 }
            if m.recipient_id == uid and m.is_read is not True: partners_map[partner_id]["unread"] += 1

        for pid, data in partners_map.items():
            try:
                user = await User.get(pid)
                if user: results.append({"id": str(user.id), "username": user.username, "avatar_url": user.avatar_url or "https://github.com/shadcn.png", "is_online": manager.is_online(pid), "unread_count": data["unread"], "type": "user", "last_timestamp": data["last_msg"].timestamp})
            except: continue

        for g in my_groups:
            last_msg = await Message.find(Message.recipient_id == str(g.id)).sort("-timestamp").first_or_none()
            timestamp = last_msg.timestamp if last_msg else g.created_at
            # Updated to prefer avatar_url if set
            avatar = g.avatar_url if g.avatar_url else f"https://api.dicebear.com/7.x/initials/svg?seed={g.name}"
            results.append({"id": str(g.id), "username": g.name, "avatar_url": avatar, "is_online": False, "type": "group", "admin_id": g.admin_id, "last_timestamp": timestamp, "unread_count": 0})

        results.sort(key=lambda x: x["last_timestamp"], reverse=True)
        return results

    except Exception as e:
        print(f"Chat List Error: {e}")
        return []

@router.get("/history/{target_id}")
async def get_chat_history(target_id: str, current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    group = await ChatGroup.get(target_id)
    messages = []
    if group:
        messages = await Message.find(Message.recipient_id == target_id).sort("+timestamp").to_list()
    else:
        await Message.find({"sender_id": target_id, "recipient_id": uid, "is_read": {"$ne": True}}).update({"$set": {"is_read": True}})
        messages = await Message.find({"$or": [{"sender_id": uid, "recipient_id": target_id}, {"sender_id": target_id, "recipient_id": uid}]}).sort("+timestamp").to_list()

    enriched_messages = []
    for m in messages:
        m_dict = m.dict()
        m_dict['id'] = str(m.id)
        m_dict['timestamp'] = str(m.timestamp)
        sender = await User.get(m.sender_id)
        m_dict['sender_name'] = sender.username if sender else "Unknown"
        enriched_messages.append(m_dict)
    return enriched_messages

@router.get("/unread-count")
async def get_total_unread(current_user: User = Depends(get_current_user)):
    count = await Message.find({"recipient_id": str(current_user.id), "is_read": {"$ne": True}}).count()
    return {"count": count}

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        sender = await User.get(user_id)
        sender_name = sender.username if sender else "Unknown"
        while True:
            data = await websocket.receive_json()
            recipient_id = data.get("recipient_id")
            content = data.get("content")
            if recipient_id and content:
                msg = Message(sender_id=user_id, recipient_id=recipient_id, content=content, is_read=False)
                await msg.insert()
                payload = msg.dict()
                payload["id"] = str(msg.id)
                payload["timestamp"] = str(msg.timestamp)
                payload["sender_name"] = sender_name
                group = await ChatGroup.get(recipient_id)
                if group:
                    for member_id in group.members:
                        if member_id != user_id: await manager.send_personal_message(payload, member_id)
                else: await manager.send_personal_message(payload, recipient_id)
    except WebSocketDisconnect: manager.disconnect(user_id)
    except Exception: manager.disconnect(user_id)