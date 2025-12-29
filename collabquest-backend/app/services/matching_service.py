from app.models import User, Team
from typing import List
from app.services.vector_store import generate_embedding, calculate_similarity

# --- HELPERS ---
def calculate_time_overlap(user_avail: list, team_avail_flat: list) -> float:
    total_overlap_minutes = 0
    def to_mins(t_str):
        if not t_str: return 0
        try:
            h, m = map(int, t_str.split(':'))
            return h * 60 + m
        except: return 0
    team_schedule = {day: [] for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
    for entry in team_avail_flat:
        if entry.enabled:
            for slot in entry.slots:
                team_schedule[entry.day].append((to_mins(slot.start), to_mins(slot.end)))
    for user_day in user_avail:
        if user_day.enabled and user_day.day in team_schedule:
            for u_slot in user_day.slots:
                u_start, u_end = to_mins(u_slot.start), to_mins(u_slot.end)
                for t_start, t_end in team_schedule[user_day.day]:
                    overlap_start = max(u_start, t_start)
                    overlap_end = min(u_end, t_end)
                    if overlap_start < overlap_end:
                        total_overlap_minutes += (overlap_end - overlap_start)
    hours = total_overlap_minutes / 60
    return min(100.0, (hours / 10) * 100)

# --- SCORING FUNCTIONS ---

async def calculate_match_score(user: User, team: Team, team_members: List[User]) -> float:
    # 1. SEMANTIC MATCH (70%)
    if not user.embedding:
        skills_str = ' '.join([s.name for s in user.skills])
        # Contextualize user data
        user_text = f"Developer with skills: {skills_str}. Interests: {' '.join(user.interests)}. About: {user.about}"
        user.embedding = generate_embedding(user_text)
        await user.save()
        
    if not team.embedding:
        # Prioritize Active Skills in embedding with explicit labels
        skills_text = ' '.join(team.active_needed_skills) if team.active_needed_skills else ' '.join(team.needed_skills)
        # We explicitly add "Open Roles" and "Looking for" to weight these terms heavily in the semantic search
        team_text = f"Project: {team.name}. Description: {team.description}. Looking for teammates with skills: {skills_text}. Open Roles: {skills_text}"
        team.embedding = generate_embedding(team_text)
        await team.save()

    semantic_score = calculate_similarity(user.embedding, team.embedding) * 100
    
    # 2. AVAILABILITY (30%)
    team_avail_flat = []
    for member in team_members:
        if member.availability:
            team_avail_flat.extend(member.availability)
    
    if not team_avail_flat:
        avail_score = 100 
    else:
        avail_score = calculate_time_overlap(user.availability, team_avail_flat)

    final_score = (semantic_score * 0.70) + (avail_score * 0.30)
    return round(final_score, 0)

def calculate_project_match(user: User, project: Team) -> float:
    if not user.embedding:
        user_text = f"{' '.join([s.name for s in user.skills])} {' '.join(user.interests)} {user.about}"
        user.embedding = generate_embedding(user_text)
        
    if not project.embedding:
        skills_text = ' '.join(project.active_needed_skills) if project.active_needed_skills else ' '.join(project.needed_skills)
        project_text = f"Project: {project.name}. Description: {project.description}. Looking for teammates with skills: {skills_text}. Open Roles: {skills_text}"
        project.embedding = generate_embedding(project_text)
        
    semantic_score = calculate_similarity(user.embedding, project.embedding) * 100
    return round(semantic_score, 0)

async def calculate_user_compatibility(user_a: User, user_b: User) -> float:
    # Ensure embeddings exist
    if not user_a.embedding:
        skills_str_a = ' '.join([s.name for s in user_a.skills])
        user_a.embedding = generate_embedding(f"Developer with skills: {skills_str_a}. Interests: {' '.join(user_a.interests)}.")
        await user_a.save()

    if not user_b.embedding:
        skills_str_b = ' '.join([s.name for s in user_b.skills])
        user_b.embedding = generate_embedding(f"Developer with skills: {skills_str_b}. Interests: {' '.join(user_b.interests)}.")
        await user_b.save()
    
    # 1. Semantic Match (70%)
    semantic_score = calculate_similarity(user_a.embedding, user_b.embedding) * 100
    
    # 2. Availability Overlap (30%)
    avail_score = calculate_time_overlap(user_a.availability, user_b.availability)
    
    # Weighted Sum
    final_score = (semantic_score * 0.70) + (avail_score * 0.30)
    
    return round(final_score, 0)