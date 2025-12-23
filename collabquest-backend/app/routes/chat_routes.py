from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, UploadFile, File
from typing import List, Optional, Dict
from pydantic import BaseModel
from app.models import Message, User, ChatGroup, Team, Match, Block, UnreadCount, Attachment
from app.auth.dependencies import get_current_user
from beanie.operators import Or, In, And
from datetime import datetime
import traceback
import shutil
import os
import uuid

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

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, List[WebSocket]] = {}
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    continue

manager = ConnectionManager()

# --- ROUTES ---

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads a file to the server and returns the URL and metadata.
    """
    try:
        # Generate unique filename
        file_ext = file.filename.split(".")[-1]
        unique_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = f"uploads/{unique_name}"
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Determine File Type
        content_type = file.content_type
        file_type = "document"
        if content_type.startswith("image/"): file_type = "image"
        elif content_type.startswith("video/"): file_type = "video"
        elif content_type.startswith("audio/"): file_type = "audio"

        # Construct URL (Assuming local for now, replace with S3 in prod)
        # Note: In production, use an ENV variable for the base URL
        file_url = f"http://localhost:8000/uploads/{unique_name}"

        return {
            "url": file_url,
            "file_type": file_type,
            "name": file.filename
        }
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(500, "File upload failed")

@router.post("/block/{user_id}")
async def block_user(user_id: str, current_user: User = Depends(get_current_user)):
    existing = await Block.find_one(Block.blocker_id == str(current_user.id), Block.blocked_id == user_id)
    if not existing:
        await Block(blocker_id=str(current_user.id), blocked_id=user_id).insert()
    return {"status": "blocked"}

@router.post("/unblock/{user_id}")
async def unblock_user(user_id: str, current_user: User = Depends(get_current_user)):
    await Block.find_one(Block.blocker_id == str(current_user.id), Block.blocked_id == user_id).delete()
    return {"status": "unblocked"}

@router.post("/request/{user_id}/accept")
async def accept_chat(user_id: str, current_user: User = Depends(get_current_user)):
    if user_id not in current_user.accepted_chat_requests:
        current_user.accepted_chat_requests.append(user_id)
        await current_user.save()
    return {"status": "accepted"}

@router.post("/read/{target_id}")
async def mark_messages_read(target_id: str, current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    group = await ChatGroup.get(target_id)
    if group:
        uc = await UnreadCount.find_one(UnreadCount.user_id == uid, UnreadCount.target_id == target_id)
        if not uc:
            uc = UnreadCount(user_id=uid, target_id=target_id, msg_count=0)
            await uc.insert()
        else:
            uc.msg_count = 0
            uc.last_read_at = datetime.now()
            await uc.save()
    else:
        # Mark all messages from this sender to me as read
        await Message.find({"sender_id": target_id, "recipient_id": uid, "is_read": {"$ne": True}}).update({"$set": {"is_read": True}})
    
    return {"status": "read"}

@router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    try:
        uid = str(current_user.id)
        results = []
        messages = await Message.find({"$or": [{"sender_id": uid}, {"recipient_id": uid}]}).sort("-timestamp").to_list(None)
        partners_map = {}
        
        my_groups = await ChatGroup.find(In(ChatGroup.members, [uid])).to_list(None)
        group_ids = [str(g.id) for g in my_groups]

        blocked_by_me = await Block.find(Block.blocker_id == uid).to_list(None)
        blocked_by_me_ids = {b.blocked_id for b in blocked_by_me}
        
        blocked_me = await Block.find(Block.blocked_id == uid).to_list(None)
        blocked_me_ids = {b.blocker_id for b in blocked_me}

        # Process Direct Messages
        for m in messages:
            partner_id = m.sender_id if m.sender_id != uid else m.recipient_id
            if partner_id in group_ids or m.recipient_id in group_ids: continue # Skip group msgs here
            
            if partner_id not in partners_map: 
                partners_map[partner_id] = { "last_msg": m, "unread": 0 }
            
            # Count unread DMs
            if m.recipient_id == uid and m.is_read is not True: 
                partners_map[partner_id]["unread"] += 1

        for pid, data in partners_map.items():
            try:
                if pid in blocked_me_ids:
                    results.append({
                        "id": pid,
                        "username": "User", 
                        "avatar_url": "https://github.com/shadcn.png",
                        "is_online": False,
                        "unread_count": 0,
                        "type": "user",
                        "last_timestamp": data["last_msg"].timestamp,
                        "last_message": "Message hidden",
                        "is_blocked_by_them": True
                    })
                else:
                    user = await User.get(pid)
                    if user: 
                        results.append({
                            "id": str(user.id), 
                            "username": user.username or "Unknown", 
                            "avatar_url": user.avatar_url or "https://github.com/shadcn.png", 
                            "is_online": manager.is_online(pid), 
                            "unread_count": data["unread"], 
                            "type": "user", 
                            "last_timestamp": data["last_msg"].timestamp,
                            "last_message": data["last_msg"].content,
                            "is_blocked_by_me": pid in blocked_by_me_ids
                        })
            except Exception: continue

        # Process Groups
        try:
            unread_docs = await UnreadCount.find(UnreadCount.user_id == uid).to_list(None)
            unread_map = {uc.target_id: uc.msg_count for uc in unread_docs}
        except: unread_map = {}

        for g in my_groups:
            last_msg = await Message.find(Message.recipient_id == str(g.id)).sort("-timestamp").first_or_none()
            timestamp = last_msg.timestamp if last_msg else g.created_at
            avatar = g.avatar_url if g.avatar_url else f"https://api.dicebear.com/7.x/initials/svg?seed={g.name}"
            badge = unread_map.get(str(g.id), 0)

            results.append({
                "id": str(g.id), 
                "username": g.name or "Group", 
                "avatar_url": avatar, 
                "is_online": False, 
                "type": "group", 
                "admin_id": g.admin_id, 
                "last_timestamp": timestamp, 
                "last_message": last_msg.content if last_msg else "No messages yet", 
                "unread_count": badge,
                "member_count": len(g.members),
                "is_team_group": g.is_team_group
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
    meta = {"blocked_by_me": False, "blocked_by_them": False, "is_pending": False}
    
    if group:
        # Clear Group Unread
        uc = await UnreadCount.find_one(UnreadCount.user_id == uid, UnreadCount.target_id == target_id)
        if uc:
             uc.msg_count = 0
             uc.last_read_at = datetime.now()
             await uc.save()
        else:
             # Create entry if missing
             await UnreadCount(user_id=uid, target_id=target_id, msg_count=0).insert()
             
        messages = await Message.find(Message.recipient_id == target_id).sort("timestamp").to_list(None)
    else:
        # DM Logic
        block_by_me = await Block.find_one(Block.blocker_id == uid, Block.blocked_id == target_id)
        block_by_them = await Block.find_one(Block.blocker_id == target_id, Block.blocked_id == uid)
        
        meta["blocked_by_me"] = bool(block_by_me)
        meta["blocked_by_them"] = bool(block_by_them)
        
        received = await Message.find(Message.sender_id == target_id, Message.recipient_id == uid).count()
        sent = await Message.find(Message.sender_id == uid, Message.recipient_id == target_id).count()
        
        if received > 0 and sent == 0 and target_id not in current_user.accepted_chat_requests:
            meta["is_pending"] = True

        # Clear DM Unread
        await Message.find({"sender_id": target_id, "recipient_id": uid, "is_read": {"$ne": True}}).update({"$set": {"is_read": True}})
        
        messages = await Message.find({"$or": [{"sender_id": uid, "recipient_id": target_id}, {"sender_id": target_id, "recipient_id": uid}]}).sort("timestamp").to_list(None)

    enriched_messages = []
    for m in messages:
        m_dict = m.dict()
        m_dict['id'] = str(m.id)
        m_dict['timestamp'] = str(m.timestamp)
        # Fetch sender info
        sender = await User.get(m.sender_id)
        m_dict['sender_name'] = sender.username if sender else "Unknown"
        enriched_messages.append(m_dict)
        
    return {"messages": enriched_messages, "meta": meta}

@router.get("/unread-count")
async def get_total_unread(current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    # 1. Unread DMs
    dm_count = await Message.find({"recipient_id": uid, "is_read": {"$ne": True}}).count()
    # 2. Unread Group Messages
    group_counts = await UnreadCount.find(UnreadCount.user_id == uid).to_list(None)
    total_group = sum([g.msg_count for g in group_counts])
    
    return {"count": dm_count + total_group}

# ... Group CRUD ...

@router.get("/groups/{group_id}")
async def get_group_details(group_id: str, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    
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

@router.put("/groups/{group_id}")
async def update_group(group_id: str, data: GroupUpdate, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    if group.admin_id != str(current_user.id): raise HTTPException(403, "Only admin can edit group info")
        
    if data.name: group.name = data.name
    if data.avatar_url: group.avatar_url = data.avatar_url
    await group.save()
    return group

@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(group_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    
    if group.admin_id != str(current_user.id): raise HTTPException(403, "Only admin can remove members")
    if user_id == group.admin_id: raise HTTPException(400, "Admin cannot be removed")

    if user_id in group.members:
        group.members.remove(user_id)
        await group.save()
        
    return group

@router.post("/groups")
async def create_group(data: GroupCreate, current_user: User = Depends(get_current_user)):
    if str(current_user.id) not in data.member_ids:
        data.member_ids.append(str(current_user.id))
    group = ChatGroup(name=data.name, admin_id=str(current_user.id), members=data.member_ids, team_id=data.team_id, is_team_group=bool(data.team_id))
    await group.insert()
    return group

# --- UPDATED: Add Member with Block Check ---
@router.put("/groups/{group_id}/members")
async def add_group_member(group_id: str, req: AddMemberRequest, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    if group.admin_id != str(current_user.id): raise HTTPException(403, "Only admin can manage members")
    
    # CHECK BLOCK
    is_blocked = await Block.find_one(Block.blocker_id == req.user_id, Block.blocked_id == group_id)
    if is_blocked:
        raise HTTPException(400, "User has blocked this group")

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

# --- NEW: LEAVE & BLOCK GROUP ---
@router.post("/groups/{group_id}/leave")
async def leave_group(group_id: str, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    uid = str(current_user.id)
    
    if uid not in group.members: raise HTTPException(400, "Not a member")
    
    group.members.remove(uid)
    if group.admin_id == uid:
        if group.members: group.admin_id = group.members[0]
        elif not group.is_team_group: await group.delete(); return {"status": "left_deleted"}
    
    await group.save()
    return {"status": "left"}

@router.post("/groups/{group_id}/block")
async def block_group(group_id: str, current_user: User = Depends(get_current_user)):
    group = await ChatGroup.get(group_id)
    if not group: raise HTTPException(404, "Group not found")
    uid = str(current_user.id)
    
    # 1. Leave
    if uid in group.members:
        group.members.remove(uid)
        if group.admin_id == uid:
            if group.members: group.admin_id = group.members[0]
            elif not group.is_team_group: await group.delete()
        await group.save()
    
    # 2. Block
    exists = await Block.find_one(Block.blocker_id == uid, Block.blocked_id == group_id)
    if not exists: await Block(blocker_id=uid, blocked_id=group_id).insert()
    
    return {"status": "blocked"}

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

# --- UPDATED WEBSOCKET FOR SIGNALING ---
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        sender = await User.get(user_id)
        sender_name = sender.username if sender else "Unknown"
        while True:
            data = await websocket.receive_json()
            recipient_id = data.get("recipient_id")
            event_type = data.get("event") # 'message' OR 'offer' / 'answer' / 'ice-candidate' / 'hang-up'
            
            # --- SIGNALING HANDLING (Calls) ---
            if event_type in ["offer", "answer", "ice-candidate", "hang-up"]:
                signal_payload = {
                    "event": event_type,
                    "sender_id": user_id,
                    "recipient_id": recipient_id,
                    "data": data.get("data") # SDP or Candidate
                }
                
                # Check if recipient is a group
                group = await ChatGroup.get(recipient_id)
                if group:
                    # Broadcast signal to all group members except sender
                    for member_id in group.members:
                        if member_id != user_id:
                            await manager.send_personal_message(signal_payload, member_id)
                else:
                    # Direct P2P Signal
                    await manager.send_personal_message(signal_payload, recipient_id)
                continue

            # --- EXISTING CHAT MESSAGE HANDLING ---
            content = data.get("content")
            attachments_data = data.get("attachments", [])
            attachments_objs = [
                Attachment(url=a["url"], file_type=a["file_type"], name=a["name"]) 
                for a in attachments_data
            ]

            if recipient_id and (content or attachments_objs):
                msg = Message(
                    sender_id=user_id, 
                    recipient_id=recipient_id, 
                    content=content or "", 
                    attachments=attachments_objs,
                    is_read=False
                )
                await msg.insert()
                
                payload = msg.dict()
                payload["id"] = str(msg.id)
                payload["timestamp"] = str(msg.timestamp)
                payload["sender_name"] = sender_name
                
                group = await ChatGroup.get(recipient_id)
                if group:
                    for member_id in group.members:
                        if member_id != user_id:
                            uc = await UnreadCount.find_one(UnreadCount.user_id == member_id, UnreadCount.target_id == recipient_id)
                            if not uc: 
                                uc = UnreadCount(user_id=member_id, target_id=recipient_id, msg_count=1)
                                await uc.insert()
                            else:
                                uc.msg_count += 1
                                uc.last_read_at = datetime.now()
                                await uc.save()
                            
                            await manager.send_personal_message({"event": "message", "message": payload}, member_id)
                else: 
                    await manager.send_personal_message({"event": "message", "message": payload}, recipient_id)
    except WebSocketDisconnect: manager.disconnect(websocket, user_id)
    except Exception: manager.disconnect(websocket, user_id)