from typing import List, Optional
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime

# ... (Keep Skill, User, Team, Swipe models as is) ...
class Skill(BaseModel):
    name: str
    level: str

class User(Document):
    github_id: str = Field(..., description="Unique ID from GitHub")
    username: str
    email: str
    avatar_url: Optional[str] = None
    trust_score: float = Field(default=5.0)
    is_verified_student: bool = False
    skills: List[Skill] = []
    class Settings: name = "users"

class Team(Document):
    name: str
    description: str
    members: List[str]
    needed_skills: List[str] = []
    project_roadmap: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.now)
    class Settings: name = "teams"

class Swipe(Document):
    swiper_id: str
    target_id: str
    direction: str 
    type: str 
    related_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    class Settings: name = "swipes"

# --- UPDATED MATCH MODEL ---
class Match(Document):
    user_id: str      # Candidate
    project_id: str
    leader_id: str
    
    # New Fields for Status & Cooldown
    status: str = "matched" # Options: matched, invited, requested, joined
    last_action_at: datetime = Field(default_factory=datetime.now) 
    
    created_at: datetime = Field(default_factory=datetime.now)
    class Settings: name = "matches"

class Notification(Document):
    recipient_id: str
    sender_id: str
    message: str
    type: str
    related_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    class Settings: name = "notifications"

class Message(Document):
    sender_id: str
    recipient_id: str
    content: str
    is_read: bool = False
    timestamp: datetime = Field(default_factory=datetime.now)
    class Settings: name = "messages"

class ChatGroup(Document):
    name: str
    admin_id: str # The creator/admin
    members: List[str] # List of User IDs
    is_team_group: bool = False
    team_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "chat_groups"