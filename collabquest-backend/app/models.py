from typing import List, Optional, Dict
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime
import uuid 

class TimeRange(BaseModel):
    start: str 
    end: str 

class DayAvailability(BaseModel):
    day: str 
    enabled: bool = False
    slots: List[TimeRange] = []

class Skill(BaseModel):
    name: str
    level: str

class DeletionRequest(BaseModel):
    is_active: bool = False
    initiator_id: str
    votes: Dict[str, str] = {} 
    created_at: datetime = Field(default_factory=datetime.now)

class CompletionRequest(BaseModel):
    is_active: bool = False
    initiator_id: str
    votes: Dict[str, str] = {}
    created_at: datetime = Field(default_factory=datetime.now)

class User(Document):
    github_id: Optional[str] = Field(None)
    google_id: Optional[str] = Field(None)
    username: str
    email: str
    password_hash: Optional[str] = None
    avatar_url: Optional[str] = None
    trust_score: float = Field(default=5.0)
    rating_count: int = Field(default=1) 
    is_verified_student: bool = False
    auth_method: str = Field(default="github") 
    
    skills: List[Skill] = []
    interests: List[str] = [] 
    about: Optional[str] = "I love building cool things!"
    availability: List[DayAvailability] = [] 
    is_looking_for_team: bool = Field(default=True)
    
    accepted_chat_requests: List[str] = [] 

    embedding: List[float] = [] 
    
    class Settings: name = "users"

class UnreadCount(Document):
    user_id: str
    target_id: str 
    msg_count: int = 0  # <--- RENAMED FROM count
    last_read_at: datetime = Field(default_factory=datetime.now)
    class Settings: name = "unread_counts"

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    assignee_id: str
    deadline: datetime
    status: str = "pending" 
    completed_at: Optional[datetime] = None 
    warning_sent: bool = False 
    verification_votes: List[str] = [] 
    rework_votes: List[str] = [] 
    created_at: datetime = Field(default_factory=datetime.now)

class Team(Document):
    name: str
    description: str
    members: List[str]
    needed_skills: List[str] = [] 
    active_needed_skills: List[str] = [] 
    is_looking_for_members: bool = Field(default=True)

    project_roadmap: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.now)
    target_members: int = Field(default=4)
    target_completion_date: Optional[datetime] = None 
    
    status: str = "planning" 
    
    deletion_request: Optional[DeletionRequest] = None
    completion_request: Optional[CompletionRequest] = None 
    tasks: List[Task] = []
    embedding: List[float] = [] 
    
    class Settings: name = "teams"

class Block(Document):
    blocker_id: str
    blocked_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    class Settings: name = "blocks"

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
    skill: str 
    text: str
    options: List[str] 
    correct_index: int
    difficulty: str 
    class Settings: name = "questions"