from app.models import User, Team
from typing import List

def normalize_skills(skills: List[any]) -> set:
    """Helper to converting mixed skill lists to a clean lowercase set"""
    clean_set = set()
    for s in skills:
        if isinstance(s, str):
            clean_set.add(s.lower().strip())
        elif hasattr(s, 'name'): # If it's a Skill object
            clean_set.add(s.name.lower().strip())
    return clean_set

def calculate_project_match(user: User, project: Team) -> float:
    """
    Calculates % match between User Skills and Project Needs.
    """
    user_skills = normalize_skills(user.skills)
    needed_skills = normalize_skills(project.needed_skills)
    
    if not needed_skills:
        return 0.0
        
    # Find overlap
    match_count = len(user_skills.intersection(needed_skills))
    
    # Calculate percentage
    score = (match_count / len(needed_skills)) * 100
    return round(score, 0)

def calculate_user_compatibility(user_a: User, user_b: User) -> float:
    """
    Calculates compatibility score (0-100).
    """
    # 1. Filter out bad users (Swagger test users)
    if user_b.username == "string" or not user_b.username:
        return 0.0

    skills_a = normalize_skills(user_a.skills)
    skills_b = normalize_skills(user_b.skills)
    
    # If user has no skills, they are not a good match
    if not skills_b:
        return 0.0

    # 2. Skill Diversity (We want different skills)
    intersection = len(skills_a.intersection(skills_b))
    union = len(skills_a.union(skills_b))
    
    diversity_score = 0
    if union > 0:
        # If I know Python and you know React -> Intersection 0 -> Diversity High
        diversity_score = (1 - (intersection / union)) * 60 
        
    # 3. Trust Score Bonus (Max 40 points)
    # A trust score of 5.0 gives 20 points. 10.0 gives 40 points.
    trust_bonus = (user_b.trust_score / 10) * 40 
    
    total_score = diversity_score + trust_bonus
    return round(total_score, 0)