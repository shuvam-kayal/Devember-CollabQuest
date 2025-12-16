from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pydantic import BaseModel
import random
from app.models import User, Question, Skill
from app.auth.dependencies import get_current_user

router = APIRouter()

class TestResponse(BaseModel):
    questions: List[dict] # Sending without correct answer to frontend

class SubmitRequest(BaseModel):
    answers: List[int] # List of selected indices [0, 2, 1...]

@router.get("/start/{skill_name}")
async def start_skill_test(skill_name: str, current_user: User = Depends(get_current_user)):
    """
    Fetches 5 Easy, 5 Medium, 5 Hard questions for the skill.
    """
    skill = skill_name.strip()
    
    # Fetch all questions for this skill
    easy = await Question.find(Question.skill == skill, Question.difficulty == "easy").to_list()
    medium = await Question.find(Question.skill == skill, Question.difficulty == "medium").to_list()
    hard = await Question.find(Question.skill == skill, Question.difficulty == "hard").to_list()
    
    if len(easy) < 5 or len(medium) < 5 or len(hard) < 5:
        # Fallback for hackathon: If not enough DB questions, return mock data or error
        # For now, let's assume seed data exists.
        pass

    # Select random 5 from each
    selected = (
        random.sample(easy, min(5, len(easy))) +
        random.sample(medium, min(5, len(medium))) +
        random.sample(hard, min(5, len(hard)))
    )
    
    # Prepare response (Hide correct answer)
    response_data = []
    for q in selected:
        response_data.append({
            "id": str(q.id),
            "text": q.text,
            "options": q.options,
            "difficulty": q.difficulty
        })
        
    return {"test_id": "session_123", "questions": response_data}

@router.post("/submit/{skill_name}")
async def submit_skill_test(skill_name: str, answers: List[dict], current_user: User = Depends(get_current_user)):
    """
    Grading Logic:
    answers = [{id: "q_id", selected: 1}, ...]
    """
    score = 0
    total = len(answers)
    
    for ans in answers:
        q_id = ans.get("id")
        selected = ans.get("selected")
        
        question = await Question.get(q_id)
        if question and question.correct_index == selected:
            score += 1
            
    percentage = (score / total) * 100 if total > 0 else 0
    
    # Determine Level
    level = "Failed"
    passed = False
    
    if percentage >= 90:
        level = "Expert"
        passed = True
    elif percentage >= 60:
        level = "Intermediate"
        passed = True
    elif percentage >= 30:
        level = "Beginner"
        passed = True
        
    # Update User Profile if passed
    if passed:
        # Remove existing if present
        current_user.skills = [s for s in current_user.skills if s.name != skill_name]
        # Add verified skill
        current_user.skills.append(Skill(name=skill_name, level=level))
        await current_user.save()
        
    return {
        "score": score,
        "total": total,
        "percentage": percentage,
        "level": level,
        "passed": passed
    }