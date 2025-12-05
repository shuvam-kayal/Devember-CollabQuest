from typing import List, Optional
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime

# 1. The Skill Schema (Embedded inside User)
class Skill(BaseModel):
    name: str  # e.g., "Python"
    level: str # "Beginner", "Intermediate", "Expert"

# 2. The User Model (The Core Identity)
class User(Document):
    github_id: str = Field(..., description="Unique ID from GitHub")
    username: str
    email: str
    avatar_url: Optional[str] = None
    
    # The "Trust" System
    trust_score: float = Field(default=5.0, description="Starts at 5.0, max 10.0")
    is_verified_student: bool = False
    
    skills: List[Skill] = []
    
    class Settings:
        name = "users" # Collection name in MongoDB

# 3. The Team Model
class Team(Document):
    name: str
    description: str
    members: List[str] # List of User IDs
    project_roadmap: Optional[dict] = None # Stores the AI-generated Gantt chart
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "teams"