from typing import List, Optional
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime

# --- NEW AVAILABILITY MODELS ---
class TimeRange(BaseModel):
    start: str # "14:00"
    end: str   # "18:00"

class DayAvailability(BaseModel):
    day: str # "Monday", "Tuesday"
    enabled: bool = False
    slots: List[TimeRange] = []

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
    
    # --- UPDATED PROFILE FIELDS ---
    skills: List[Skill] = []
    interests: List[str] = [] 
    expanded_interests: List[str] = [] # <--- NEW: Hidden field for AI matching
    about: Optional[str] = "I love building cool things!"
    
    # Replaces 'availability_hours'
    availability: List[DayAvailability] = [] 
    
    class Settings:
        name = "users"

# ... (Keep Team, Swipe, Match, Notification, Message, ChatGroup unchanged) ...
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

class Match(Document):
    user_id: str
    project_id: str
    leader_id: str
    status: str = "matched"
    rejected_by: Optional[str] = None
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
    action_status: str = "pending"
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
    admin_id: str
    members: List[str]
    is_team_group: bool = False
    team_id: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    class Settings: name = "chat_groups"