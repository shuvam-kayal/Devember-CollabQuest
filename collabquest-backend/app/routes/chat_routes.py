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

class AddMemberRequest(BaseModel):
    user_id: str

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

# --- ROUTES ---

@router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    try:
        uid = str(current_user.id)
        results = []
        
        # 1. 1-on-1 Chats
        messages = await Message.find(Or(Message.sender_id == uid, Message.recipient_id == uid)).sort("-timestamp").to_list()
        partners_map = {}
        
        # 2. Groups
        my_groups = await ChatGroup.find(In(ChatGroup.members, [uid])).to_list()
        group_ids = [str(g.id) for g in my_groups]

        for m in messages:
            partner_id = m.sender_id if m.sender_id != uid else m.recipient_id
            
            if partner_id in group_ids or m.recipient_id in group_ids:
                continue

            if partner_id not in partners_map:
                partners_map[partner_id] = { "last_msg": m, "unread": 0 }
            
            # Count unread if I am recipient and it is NOT read
            if m.recipient_id == uid and m.is_read is not True:
                partners_map[partner_id]["unread"] += 1

        # Process Users
        for pid, data in partners_map.items():
            try:
                user = await User.get(pid)
                if user:
                    results.append({
                        "id": str(user.id),
                        "username": user.username,
                        "avatar_url": user.avatar_url or "https://github.com/shadcn.png",
                        "is_online": manager.is_online(pid),
                        "unread_count": data["unread"],
                        "type": "user",
                        "last_timestamp": data["last_msg"].timestamp
                    })
            except: continue

        # Process Groups
        for g in my_groups:
            last_msg = await Message.find(Message.recipient_id == str(g.id)).sort("-timestamp").first_or_none()
            timestamp = last_msg.timestamp if last_msg else g.created_at
            
            results.append({
                "id": str(g.id),
                "username": g.name,
                "avatar_url": f"https://api.dicebear.com/7.x/initials/svg?seed={g.name}",
                "is_online": False,
                "type": "group",
                "admin_id": g.admin_id,
                "last_timestamp": timestamp,
                "unread_count": 0 
            })

        results.sort(key=lambda x: x["last_timestamp"], reverse=True)
        return results

    except Exception as e:
        print(f"Chat List Error: {e}")
        traceback.print_exc()
        return []

@router.get("/history/{target_id}")
async def get_chat_history(target_id: str, current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    
    group = await ChatGroup.get(target_id)
    
    messages = []
    if group:
        messages = await Message.find(Message.recipient_id == target_id).sort("+timestamp").to_list()
        # Group read receipt logic is complex, skipping for hackathon scope
    else:
        # 1-on-1: Mark messages sent TO me, FROM target as read
        await Message.find(
            {"sender_id": target_id, "recipient_id": uid, "is_read": {"$ne": True}}
        ).update({"$set": {"is_read": True}})
        
        messages = await Message.find(
            {
                "$or": [
                    {"sender_id": uid, "recipient_id": target_id},
                    {"sender_id": target_id, "recipient_id": uid}
                ]
            }
        ).sort("+timestamp").to_list()

    # Enrich
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
    """Count messages where I am recipient and is_read is NOT true"""
    count = await Message.find({"recipient_id": str(current_user.id), "is_read": {"$ne": True}}).count()
    return {"count": count}

# --- WEBSOCKET ---
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
                # Save as Unread
                msg = Message(sender_id=user_id, recipient_id=recipient_id, content=content, is_read=False)
                await msg.insert()
                
                payload = msg.dict()
                payload["id"] = str(msg.id)
                payload["timestamp"] = str(msg.timestamp)
                payload["sender_name"] = sender_name

                group = await ChatGroup.get(recipient_id)
                
                if group:
                    for member_id in group.members:
                        if member_id != user_id:
                            await manager.send_personal_message(payload, member_id)
                else:
                    await manager.send_personal_message(payload, recipient_id)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception:
        manager.disconnect(user_id)

# ... (Groups/Contacts routes remain unchanged from previous step) ...
@router.post("/groups")
async def create_group(data: GroupCreate, current_user: User = Depends(get_current_user)):
    if str(current_user.id) not in data.member_ids:
        data.member_ids.append(str(current_user.id))
    group = ChatGroup(name=data.name, admin_id=str(current_user.id), members=data.member_ids, team_id=data.team_id, is_team_group=bool(data.team_id))
    await group.insert()
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