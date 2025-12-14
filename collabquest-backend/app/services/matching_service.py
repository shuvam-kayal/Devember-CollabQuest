from app.models import User, Team
from typing import List

# --- HELPERS ---

def normalize_list(items: List[any]) -> set:
    """Helper to normalize mixed lists (strings or objects) to lowercase set"""
    clean_set = set()
    for item in items:
        if isinstance(item, str):
            clean_set.add(item.lower().strip())
        elif hasattr(item, 'name'): # Handle Skill objects
            clean_set.add(item.name.lower().strip())
    return clean_set

def calculate_time_overlap(user_avail: list, team_avail_flat: list) -> float:
    """
    Calculates overlap score based on intersecting time slots.
    Input: List of DayAvailability objects.
    """
    total_overlap_minutes = 0
    
    # Helper: Convert 'HH:MM' to minutes since midnight
    def to_mins(t_str):
        if not t_str: return 0
        try:
            h, m = map(int, t_str.split(':'))
            return h * 60 + m
        except: return 0

    # 1. Map team availability by day
    # Structure: { "Monday": [(start_min, end_min), ...], ... }
    team_schedule = {day: [] for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
    
    for entry in team_avail_flat:
        if entry.enabled:
            for slot in entry.slots:
                team_schedule[entry.day].append((to_mins(slot.start), to_mins(slot.end)))

    # 2. Check overlap against User availability
    for user_day in user_avail:
        if user_day.enabled and user_day.day in team_schedule:
            for u_slot in user_day.slots:
                u_start, u_end = to_mins(u_slot.start), to_mins(u_slot.end)
                
                # Compare with every slot the team has on this day
                for t_start, t_end in team_schedule[user_day.day]:
                    # Overlap logic: max(start1, start2) < min(end1, end2)
                    overlap_start = max(u_start, t_start)
                    overlap_end = min(u_end, t_end)
                    
                    if overlap_start < overlap_end:
                        total_overlap_minutes += (overlap_end - overlap_start)

    # 3. Scoring:
    # Let's say 10 hours (600 mins) of overlap per week is "Perfect" (100%)
    # If overlap is 0, score is 0.
    hours = total_overlap_minutes / 60
    return min(100.0, (hours / 10) * 100)

# --- MAIN SCORING FUNCTIONS ---

async def calculate_match_score(user: User, team: Team, team_members: List[User]) -> float:
    """
    Calculates weighted match score:
    - 50% Skills Match
    - 30% Availability Overlap
    - 20% Interest Match
    """
    
    # 1. SKILLS (50%)
    user_skills = normalize_list(user.skills)
    needed_skills = normalize_list(team.needed_skills)
    
    if needed_skills:
        match_count = len(user_skills.intersection(needed_skills))
        skill_score = (match_count / len(needed_skills)) * 100
    else:
        skill_score = 100 # No requirements = perfect match

    # 2. AVAILABILITY (30%)
    # Flatten availability of all current team members
    team_avail_flat = []
    for member in team_members:
        if member.availability:
            team_avail_flat.extend(member.availability)
    
    if not team_avail_flat:
        # If team has no defined availability (empty team or lazy members), assume 100% fit
        avail_score = 100 
    else:
        avail_score = calculate_time_overlap(user.availability, team_avail_flat)

    # 3. INTERESTS (20%)
    # Use expanded_interests (AI generated) if available, else standard interests
    user_ints = set(user.expanded_interests or user.interests)
    
    # Collect all team interests
    team_ints = set()
    for m in team_members:
        # Also check against project description keywords as simple interests
        if m.interests:
            team_ints.update(m.expanded_interests or m.interests)
            
    # Add Project Name/Description tokens to "Team Interests"
    proj_tokens = set(team.name.lower().split() + team.description.lower().split())
    team_ints.update(proj_tokens)

    if team_ints:
        int_match = len(user_ints.intersection(team_ints))
        # Heuristic: 3 shared concepts is a "Great" culture fit
        interest_score = min(100.0, (int_match / 3) * 100)
    else:
        interest_score = 50 # Neutral

    # Weighted Sum
    final_score = (skill_score * 0.50) + (avail_score * 0.30) + (interest_score * 0.20)
    
    return round(final_score, 0)

def calculate_project_match(user: User, project: Team) -> float:
    """Legacy helper for simple matches (if member list unavailable)"""
    # Simple skill match fallback
    user_skills = normalize_list(user.skills)
    needed_skills = normalize_list(project.needed_skills)
    if not needed_skills: return 100.0
    match_count = len(user_skills.intersection(needed_skills))
    return round((match_count / len(needed_skills)) * 100, 0)

def calculate_user_compatibility(user_a: User, user_b: User) -> float:
    """Legacy helper for User-User matching"""
    skills_a = normalize_list(user_a.skills)
    skills_b = normalize_list(user_b.skills)
    if not skills_b: return 0.0
    
    intersection = len(skills_a.intersection(skills_b))
    union = len(skills_a.union(skills_b))
    diversity_score = 0
    if union > 0: diversity_score = (1 - (intersection / union)) * 50
    
    trust_score = (user_b.trust_score / 10) * 50
    return round(diversity_score + trust_score, 0)