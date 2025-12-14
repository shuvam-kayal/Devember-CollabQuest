from typing import List, Optional, Dict
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

# --- NEW: DELETION REQUEST MODEL ---
class DeletionRequest(BaseModel):
    is_active: bool = False
    initiator_id: str
    votes: Dict[str, str] = {} # user_id -> "approve" or "reject"
    created_at: datetime = Field(default_factory=datetime.now)

class User(Document):
    github_id: str = Field(..., description="Unique ID from GitHub")
    username: str
    email: str
    avatar_url: Optional[str] = None
    trust_score: float = Field(default=5.0)
    is_verified_student: bool = False
    skills: List[Skill] = []
    interests: List[str] = [] 
    expanded_interests: List[str] = []
    about: Optional[str] = "I love building cool things!"
    availability: List[DayAvailability] = [] 
    class Settings: name = "users"

class Team(Document):
    name: str
    description: str
    members: List[str]
    needed_skills: List[str] = []
    project_roadmap: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.now)
    target_members: int = Field(default=4)
    target_completion_date: Optional[datetime] = None 
    
    # --- NEW FIELD ---
    deletion_request: Optional[DeletionRequest] = None
    
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

class Question(Document):
    skill: str # "Python", "React"
    text: str
    options: List[str] # ["A", "B", "C", "D"]
    correct_index: int
    difficulty: str # "easy", "medium", "hard"
    
    class Settings:
        name = "questions"