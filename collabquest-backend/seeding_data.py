import asyncio
import random
import os
from app.database import init_db
from app.models import User, Team, Skill, DayAvailability, TimeRange

# Windows Fix
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- DATA POOLS ---
SKILLS_POOL = [
    "React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", 
    "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", 
    "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"
]

INTERESTS_POOL = [
    "FinTech", "HealthTech", "EdTech", "Social Good", "Blockchain", 
    "Gaming", "AI Automation", "Sustainability", "E-commerce", "Cybersecurity"
]

USERS_DATA = [
    ("Alice", "Frontend Wizard"), ("Bob", "Backend Guru"), ("Charlie", "Full Stack Dev"),
    ("Diana", "AI Researcher"), ("Ethan", "Mobile App Expert"), ("Fiona", "UI/UX Designer"),
    ("George", "DevOps Engineer"), ("Hannah", "Blockchain Enthusiast"), ("Ian", "Security Analyst"),
    ("Julia", "Product Manager")
]

PROJECTS_DATA = [
    ("EcoTracker", "AI app to track personal carbon footprint using gamification."),
    ("CryptoDash", "Real-time crypto trading visualization dashboard with alerts."),
    ("StudyBud", "Tinder-style matching app for finding study partners on campus."),
    ("FitQuest", "RPG game that levels up your character when you work out."),
    ("CodeCollab", "Real-time collaborative code editor with video chat.")
]

# --- HELPERS ---
def generate_availability(type="standard"):
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    avail_list = []
    
    for day in days:
        enabled = False
        slots = []
        
        if type == "standard" and day not in ["Saturday", "Sunday"]:
            enabled = True
            slots = [TimeRange(start="09:00", end="17:00")]
        elif type == "evening" and day not in ["Saturday", "Sunday"]:
            enabled = True
            slots = [TimeRange(start="18:00", end="22:00")]
        elif type == "weekend" and day in ["Saturday", "Sunday"]:
            enabled = True
            slots = [TimeRange(start="10:00", end="20:00")]
        elif type == "any":
            enabled = random.choice([True, False])
            if enabled: slots = [TimeRange(start="12:00", end="16:00")]

        avail_list.append(DayAvailability(day=day, enabled=enabled, slots=slots))
    
    return avail_list

async def seed():
    try:
        print("🔌 Connecting to Database...")
        await init_db()
        print("✅ Database Connected")

        created_users = []
        
        print("🌱 Seeding Users...")
        for i, (name, bio) in enumerate(USERS_DATA):
            # 1. Random Skills
            my_skills = [Skill(name=s, level="Intermediate") for s in random.sample(SKILLS_POOL, k=random.randint(3, 6))]
            # 2. Random Interests
            my_interests = random.sample(INTERESTS_POOL, k=random.randint(2, 4))
            # 3. Random Availability Profile
            sched_type = random.choice(["standard", "evening", "weekend", "any"])
            my_avail = generate_availability(sched_type)
            
            user = User(
                github_id=str(random.randint(10000, 99999)),
                username=name,
                email=f"{name.lower()}@example.com",
                avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={name}", 
                trust_score=round(random.uniform(6.0, 9.8), 1),
                is_verified_student=True,
                about=f"{bio}. working on {sched_type} schedule.",
                skills=my_skills,
                interests=my_interests,
                availability=my_avail
            )
            
            # Upsert
            existing = await User.find_one(User.username == name)
            if not existing:
                await user.insert()
                created_users.append(user)
                print(f"   - Created {name} ({sched_type})")
            else:
                created_users.append(existing)

        print("\n🌱 Seeding Projects...")
        for title, desc in PROJECTS_DATA:
            leader = random.choice(created_users)
            needed = random.sample(SKILLS_POOL, k=random.randint(2, 4))
            
            team = Team(
                name=title,
                description=desc,
                members=[str(leader.id)],
                needed_skills=needed,
                project_roadmap={}
            )
            
            existing = await Team.find_one(Team.name == title)
            if not existing:
                await team.insert()
                print(f"   - Created {title} (Leader: {leader.username})")

        print("\n🚀 DONE! Login via: http://localhost:8000/auth/dev/Alice")

    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(seed())