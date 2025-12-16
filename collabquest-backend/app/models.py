from typing import List, Optional, Dict
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime
import uuid # <--- IMPORTANT IMPORT

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

# --- MODELS FOR VOTING ---
class DeletionRequest(BaseModel):
    is_active: bool = False
    initiator_id: str
    votes: Dict[str, str] = {} # user_id -> "approve" | "reject"
    created_at: datetime = Field(default_factory=datetime.now)

class CompletionRequest(BaseModel):
    is_active: bool = False
    initiator_id: str
    votes: Dict[str, str] = {}
    created_at: datetime = Field(default_factory=datetime.now)

class User(Document):
    github_id: Optional[str] = Field(None, description="Unique ID from GitHub")
    google_id: Optional[str] = Field(None, description="Unique ID from Google")
    username: str
    email: str
    password_hash: Optional[str] = None  # For email/password auth
    avatar_url: Optional[str] = None
    trust_score: float = Field(default=5.0)
    rating_count: int = Field(default=1) # <--- NEW: To track average
    is_verified_student: bool = False
    auth_method: str = Field(default="github")  # "github", "google", or "email"
    
    # --- UPDATED PROFILE FIELDS ---
    skills: List[Skill] = []
    interests: List[str] = [] 
    expanded_interests: List[str] = []
    about: Optional[str] = "I love building cool things!"
    availability: List[DayAvailability] = [] 
    class Settings: name = "users"

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    assignee_id: str
    deadline: datetime
    status: str = "pending" # "pending", "review", "completed"
    completed_at: Optional[datetime] = None # <--- NEW: Track finish time
    warning_sent: bool = False # <--- NEW: To track 24h warning
    verification_votes: List[str] = [] # List of user_ids who approved
    rework_votes: List[str] = [] # <--- NEW: Track rework requests
    created_at: datetime = Field(default_factory=datetime.now)

class Team(Document):
    name: str
    description: str
    members: List[str]
    needed_skills: List[str] = []
    project_roadmap: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.now)
    target_members: int = Field(default=4)
    target_completion_date: Optional[datetime] = None 
    
    status: str = "active" # <--- NEW: 'active' or 'completed'
    deletion_request: Optional[DeletionRequest] = None
    completion_request: Optional[CompletionRequest] = None # <--- NEW
    tasks: List[Task] = []
    
    class Settings: name = "teams"

# ... (Keep Swipe, Match, Notification, Message, ChatGroup, Question unchanged) ...
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
    class Settings: name = "questions"