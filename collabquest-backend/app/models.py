from typing import List, Optional
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime

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
    
    class Settings:
        name = "users"

class Team(Document):
    name: str
    description: str
    members: List[str]
    needed_skills: List[str] = []
    project_roadmap: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "teams"

class Swipe(Document):
    swiper_id: str
    target_id: str
    direction: str 
    type: str 
    # --- NEW FIELD ---
    related_id: Optional[str] = None # Stores Project ID context
    # -----------------
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "swipes"

class Match(Document):
    user_id: str
    project_id: str
    leader_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "matches"

class Notification(Document):
    recipient_id: str
    sender_id: str
    message: str
    type: str
    related_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "notifications"