import asyncio
import random
import os
from app.database import init_db
from app.models import User, Team, Skill

# --- WINDOWS FIX ---
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configuration
SKILLS_POOL = [
    "React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", 
    "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", 
    "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"
]

USERS_DATA = [
    ("Alice", "Frontend Wizard"),
    ("Bob", "Backend Guru"),
    ("Charlie", "Full Stack Dev"),
    ("Diana", "AI Researcher"),
    ("Ethan", "Mobile App Expert"),
    ("Fiona", "UI/UX Designer"),
    ("George", "DevOps Engineer"),
    ("Hannah", "Blockchain Enthusiast")
]

PROJECTS_DATA = [
    ("EcoTracker", "AI app to track personal carbon footprint using gamification."),
    ("CryptoDash", "Real-time crypto trading visualization dashboard with alerts."),
    ("StudyBud", "Tinder-style matching app for finding study partners on campus."),
    ("FitQuest", "RPG game that levels up your character when you work out."),
    ("CodeCollab", "Real-time collaborative code editor with video chat."),
    ("Mars Rover UI", "Mission control dashboard for a Mars rover simulation."),
    ("Recipe Gen", "AI-powered food suggestion app based on fridge ingredients.")
]

async def seed():
    try:
        print("🔌 Connecting to Database...")
        await init_db()
        print("✅ Database Connected")

        # 1. Create Users
        created_users = []
        print("🌱 Seeding Users...")
        
        for name, bio in USERS_DATA:
            # Pick 3-5 random skills
            my_skills_names = random.sample(SKILLS_POOL, k=random.randint(3, 5))
            # Convert to Skill Objects (Schema Requirement)
            skill_objects = [Skill(name=s, level="Intermediate") for s in my_skills_names]
            
            user = User(
                github_id=str(random.randint(10000, 99999)),
                username=name,
                email=f"{name.lower()}@example.com",
                avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={name}", 
                trust_score=round(random.uniform(6.0, 9.8), 1),
                is_verified_student=True,
                skills=skill_objects
            )
            await user.insert()
            created_users.append(user)
            print(f"   - Created User: {name} ({', '.join(my_skills_names)})")

        # 2. Create Projects
        print("\n🌱 Seeding Projects...")
        
        for title, desc in PROJECTS_DATA:
            # Pick a random leader
            leader = random.choice(created_users)
            
            # Pick 2-4 random needed skills
            needed = random.sample(SKILLS_POOL, k=random.randint(2, 4))
            
            team = Team(
                name=title,
                description=desc,
                members=[str(leader.id)],
                needed_skills=needed, # Schema expects List[str], which this is
                project_roadmap={}
            )
            await team.insert()
            print(f"   - Created Project: {title} (Leader: {leader.username})")

        print("\n🚀 DONE! You are ready to demo.")
        print("💡 TIP: Login as 'Alice' via http://localhost:8000/auth/dev/Alice")

    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(seed())