import asyncio
import random
import os
import sys

# Force UTF-8 encoding for stdout (Windows fix)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta
from app.database import init_db
from app.models import (
    User, Team, Skill, DayAvailability, TimeRange, Question, 
    TrustBreakdown, Education, Link, Achievement, ConnectedAccounts, 
    VisibilitySettings, Rating, Task
)

# Windows Fix
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- DATA POOLS ---
SKILLS_POOL = [
    "React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", 
    "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", 
    "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity", 
    "GraphQL", "PostgreSQL", "Angular", "Vue.js", "Swift"
]

INTERESTS_POOL = [
    "Gaming", "AI Automation", "Sustainability", "E-commerce", "Cybersecurity",
    "FinTech", "EdTech", "HealthTech", "Robotics", "Blockchain", "Open Source"
]

# --- QUESTION BANKS ---

PYTHON_QS = [
    ("What is the output of print(2 ** 3)?", ["6", "8", "9", "Error"], 1, "easy"),
    ("Which keyword is used to define a function?", ["func", "def", "function", "define"], 1, "easy"),
    ("What is a tuple?", ["Mutable list", "Immutable list", "Dictionary", "Set"], 1, "easy"),
    ("How do you start a comment?", ["//", "#", "/*", "<!--"], 1, "easy"),
    ("Which is not a valid variable name?", ["my_var", "_var", "2var", "var2"], 2, "easy"),
    ("What does the 'pass' keyword do?", ["Stops execution", "Does nothing", "Skips loop", "Returns None"], 1, "medium"),
    ("What is the output of [1, 2] * 2?", ["[1, 2, 2]", "[1, 2, 1, 2]", "[2, 4]", "Error"], 1, "medium"),
    ("Which data structure is LIFO?", ["Queue", "Stack", "List", "Tree"], 1, "medium"),
    ("What is a decorator?", ["A class", "A function that modifies another function", "A variable", "A string"], 1, "medium"),
    ("What is __init__?", ["Constructor", "Destructor", "Import", "Loop"], 0, "medium"),
    ("What is the GIL?", ["Global Interpreter Lock", "General Interface Logic", "Graphical Interface Loop", "None"], 0, "hard"),
    ("What is the difference between @staticmethod and @classmethod?", ["None", "Class method takes cls", "Static method takes cls", "Both take self"], 1, "hard"),
    ("How does Python handle memory management?", ["Manual", "Garbage Collection", "Pointers", "Stack only"], 1, "hard"),
    ("What is a generator?", ["Function yielding values", "List comprehension", "A loop", "A class"], 0, "hard"),
    ("What is MRO?", ["Method Resolution Order", "Memory Read Operation", "Main Runtime Object", "None"], 0, "hard")
]

JS_QS = [
    ("Which keyword declares a block-scoped variable?", ["var", "let", "val", "const var"], 1, "easy"),
    ("What does '===' operator do?", ["Assigns value", "Equal value and type", "Equal value only", "None"], 1, "easy"),
    ("How do you write 'Hello World' in an alert box?", ["msg('Hello World')", "alertBox('Hello World')", "alert('Hello World')", "msgBox('Hello World')"], 2, "easy"),
    ("Which symbol is used for comments in JS?", ["//", "#", "<!--", "**"], 0, "easy"),
    ("What is the correct way to write an array?", ["['a', 'b']", "{'a', 'b'}", "('a', 'b')", "None"], 0, "easy"),
    ("What is a Closure?", ["Function inside function", "Loop", "Object", "Array"], 0, "medium"),
    ("What is the output of '2' + 2?", ["4", "22", "NaN", "Error"], 1, "medium"),
    ("Which array method adds elements to the end?", ["push()", "pop()", "shift()", "unshift()"], 0, "medium"),
    ("What does 'this' refer to?", ["Global object", "Current object", "Function", "Variable"], 1, "medium"),
    ("What is the purpose of JSON.stringify()?", ["Parse JSON", "Convert obj to string", "Convert string to obj", "None"], 1, "medium"),
    ("What is hoisting?", ["Moving declarations to top", "Lifting weights", "Creating variables", "None"], 0, "hard"),
    ("What is the Event Loop?", ["Handles async callbacks", "A for loop", "DOM event", "Error handler"], 0, "hard"),
    ("Explain Promises.", ["Synchronous code", "Future value placeholder", "Function", "Array"], 1, "hard"),
    ("What is the difference between null and undefined?", ["Same", "Null is object, undefined is type", "Null is type", "None"], 1, "hard"),
    ("What is a generator function?", ["Function that can pause/resume", "Creates objects", "Loop", "None"], 0, "hard")
]

CPP_QS = [
    ("Which symbol is used for comments?", ["//", "#", "<!--", "--"], 0, "easy"),
    ("What is the correct way to include a library?", ["import <iostream>", "include <iostream>", "#include <iostream>", "using <iostream>"], 2, "easy"),
    ("How do you print to console?", ["print()", "cout <<", "System.out.println", "echo"], 1, "easy"),
    ("Which data type is used for 'A'?", ["char", "string", "int", "bool"], 0, "easy"),
    ("How do you declare a variable?", ["int x;", "x = 10;", "var x;", "declare x"], 0, "easy"),
    ("What is a pointer?", ["Holds address", "Holds value", "A class", "A loop"], 0, "medium"),
    ("What is a reference?", ["Alias for variable", "Copy of variable", "Pointer", "None"], 0, "medium"),
    ("What is the size of int?", ["2 bytes", "4 bytes", "8 bytes", "Depends on compiler"], 3, "medium"),
    ("What is the keyword for inheritance?", ["extends", "inherits", ":", "implements"], 2, "medium"),
    ("What is encapsulation?", ["Hiding data", "Sharing data", "Global data", "None"], 0, "medium"),
    ("What is a destructor?", ["~ClassName()", "ClassName()", "delete()", "free()"], 0, "hard"),
    ("What is virtual function?", ["Static function", "Runtime polymorphism", "Compile time", "None"], 1, "hard"),
    ("What is a template?", ["Generic programming", "A class", "A function", "A file"], 0, "hard"),
    ("Difference between struct and class?", ["Visibility", "Size", "None", "Name"], 0, "hard"),
    ("What is a pure virtual function?", ["Has no body", "Has body", "Static", "None"], 0, "hard")
]

REACT_QS = [
    ("What is a Component?", ["Function returning UI", "Database", "Server", "Loop"], 0, "easy"),
    ("What is State?", ["Internal data storage", "External data", "Global variable", "None"], 0, "easy"),
    ("What is Props?", ["Arguments to components", "Internal state", "HTML attribute", "Style"], 0, "easy"),
    ("What is the entry point of a React app?", ["index.js", "app.js", "main.js", "home.js"], 0, "easy"),
    ("Which hook handles side effects?", ["useEffect", "useState", "useReducer", "useRef"], 0, "easy"),
    ("What is useEffect used for?", ["Side effects", "State", "Routing", "Styling"], 0, "medium"),
    ("What is JSX?", ["Syntax extension for JS", "Java XML", "JSON XML", "None"], 0, "medium"),
    ("How do you create a ref?", ["useRef()", "createRef()", "ref()", "this.ref"], 0, "medium"),
    ("What is Redux?", ["State management library", "Database", "Server", "Framework"], 0, "medium"),
    ("How to prevent re-renders?", ["React.memo", "useEffect", "useState", "None"], 0, "medium"),
    ("What is the Virtual DOM?", ["Lightweight copy of DOM", "Real DOM", "Browser API", "None"], 0, "hard"),
    ("What is Context API?", ["Prop drilling solution", "State management", "Routing", "API calls"], 0, "hard"),
    ("What are Hooks?", ["Use state/effects in functions", "Class methods", "Event handlers", "None"], 0, "hard"),
    ("What is higher-order component?", ["Function taking component returning component", "Parent component", "Child component", "None"], 0, "hard"),
    ("What is reconciliation?", ["Diffing algorithm", "State update", "Routing", "None"], 0, "hard")
]

# --- USERS ---
USERS_DATA = [
    ("Alice", "Frontend Wizard"), ("Bob", "Backend Guru"), ("Charlie", "Full Stack Dev"),
    ("Diana", "AI Researcher"), ("Ethan", "Mobile App Expert"), ("Fiona", "UI/UX Designer"),
    ("George", "DevOps Engineer"), ("Hannah", "Blockchain Enthusiast"), ("Ian", "Security Analyst"),
    ("Julia", "Product Manager"), ("Kevin", "Data Scientist"), ("Liam", "Game Developer"),
    ("Mia", "Cloud Architect"), ("Noah", "Embedded Systems"), ("Olivia", "AR/VR Developer"),
    ("Paul", "Tech Lead"), ("Quinn", "QA Engineer"), ("Rachel", "System Admin"),
    ("Sam", "Network Engineer"), ("Tina", "Database Admin")
]

# --- PROJECTS ---
PROJECTS_DATA = [
    ("EcoTracker", "AI app to track personal carbon footprint using gamification."),
    ("CryptoDash", "Real-time crypto trading visualization dashboard with alerts."),
    ("StudyBud", "Tinder-style matching app for finding study partners on campus."),
    ("FitQuest", "RPG game that levels up your character when you work out."),
    ("CodeCollab", "Real-time collaborative code editor with video chat."),
    ("AutoInvest", "Robo-advisor for stocks using machine learning prediction models."),
    ("HealthChain", "Secure medical records storage using blockchain technology."),
    ("SmartHome", "IoT dashboard for controlling smart devices at home."),
    ("LearnLanguage", "Duolingo clone with VR integration for immersive learning."),
    ("RecipeGenie", "AI-powered recipe generator based on ingredients you have.")
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
    
def generate_education():
    universities = ["MIT", "Stanford", "Harvard", "UC Berkeley", "IIT Bombay", "Tsinghua University"]
    courses = ["Computer Science", "Software Engineering", "Data Science", "AI & Robotics"]
    
    return [
        Education(
            institute=random.choice(universities),
            course=random.choice(courses),
            year_of_study=str(random.randint(1, 4)),
            is_completed=random.choice([True, False]),
            is_visible=True
        )
    ]

def generate_achievements():
    titles = ["Hackathon Winner", "Open Source Contributor", "Top 500 Coder", "Best UI Design"]
    return [
        Achievement(
            title=random.choice(titles),
            date="2024-01-15",
            description="Achieved meaningful impact in tech."
        )
    ]

async def seed():
    try:
        print("🔌 Connecting to Database...")
        await init_db()
        print("✅ Database Connected")

        created_users = []
        
        print(f"🌱 Seeding {len(USERS_DATA)} Users...")
        for i, (name, bio) in enumerate(USERS_DATA):
            # 1. Random Skills
            my_skills = [Skill(name=s, level=random.choice(["Beginner", "Intermediate", "Expert"])) for s in random.sample(SKILLS_POOL, k=random.randint(3, 6))]
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
                rating_count=random.randint(1, 100),
                is_verified_student=True,
                auth_method="github",
                about=f"{bio}. woking on {sched_type} schedule.",
                skills=my_skills,
                interests=my_interests,
                availability=my_avail,
                is_looking_for_team=True, # Explicitly set
                
                # --- NEW FIELDS ---
                trust_score_breakdown=TrustBreakdown(
                    base=5.0,
                    github=random.uniform(0, 1.0),
                    linkedin=random.uniform(0, 1.0),
                    codeforces=random.uniform(0, 1.0),
                    leetcode=random.uniform(0, 1.0),
                    details=["Verified Student", "Active on GitHub"]
                ),
                education=generate_education(),
                achievements=generate_achievements(),
                social_links=[
                    Link(platform="twitter", url=f"https://twitter.com/{name}"),
                    Link(platform="instagram", url=f"https://instagram.com/{name}")
                ],
                professional_links=[
                    Link(platform="linkedin", url=f"https://linkedin.com/in/{name}"),
                    Link(platform="github", url=f"https://github.com/{name}")
                ],
                connected_accounts=ConnectedAccounts(
                    github=name,
                    linkedin=name,
                    codeforces=name,
                    leetcode=name
                ),
                visibility_settings=VisibilitySettings(),
                platform_stats={
                    "github": {"repos": 10, "stars": 50},
                    "leetcode": {"solved": 200, "rank": 15000}
                },
                connections=[], # To be filled later if needed
                embedding=[] # Initialize empty, will be generated if they login/update
            )
            
            # Upsert
            existing = await User.find_one(User.username == name)
            if not existing:
                await user.insert()
                created_users.append(user)
                # print(f"   - Created {name}")
            else:
                created_users.append(existing)

        print(f"✅ Users Seeded.")
        
        # --- SEED CONNECTIONS ---
        print("🌱 Seeding Connections...")
        for user in created_users:
            # Randomly connect with 2-3 other users
            others = [u for u in created_users if u.id != user.id]
            friends = random.sample(others, k=random.randint(1, 3))
            
            for friend in friends:
                if str(friend.id) not in user.connections:
                    user.connections.append(str(friend.id))
                    friend.connections.append(str(user.id))
                    await user.save()
                    await friend.save()
        print("✅ Connections Seeded.")

        print(f"🌱 Seeding {len(PROJECTS_DATA)} Projects...")
        for title, desc in PROJECTS_DATA:
            leader = random.choice(created_users)
            needed = random.sample(SKILLS_POOL, k=random.randint(3, 5))
            active_needed = random.sample(needed, k=min(len(needed), 2)) # Subset active
            
            team = Team(
                name=title,
                description=desc,
                members=[str(leader.id)],
                needed_skills=needed,
                active_needed_skills=active_needed,
                project_roadmap={},
                is_looking_for_members=True,
                
                # --- NEW FIELDS ---
                target_completion_date=datetime.now() + timedelta(days=random.randint(30, 90)),
                status="planning",
                target_members=random.randint(3, 6),
                embedding=[],
                tasks=[
                    Task(
                        description="Initial Setup",
                        assignee_id=str(leader.id),
                        deadline=datetime.now() + timedelta(days=7),
                        status="completed",
                        completed_at=datetime.now()
                    ),
                    Task(
                        description="Design Database Schema",
                        assignee_id=str(leader.id),
                        deadline=datetime.now() + timedelta(days=14),
                        status="pending"
                    )
                ]
            )
            
            existing = await Team.find_one(Team.name == title)
            if not existing:
                await team.insert()
                # print(f"   - Created {title} (Leader: {leader.username})")

        print("✅ Projects Seeded.")

        print("🌱 Seeding Questions...")
        
        async def seed_q(qs, skill):
            count = 0
            for q in qs:
                # Jumble up options
                options = q[1][:]
                correct_val = options[q[2]]
                random.shuffle(options)
                new_correct_idx = options.index(correct_val)

                await Question(
                    skill=skill,
                    text=q[0],
                    options=options,
                    correct_index=new_correct_idx,
                    difficulty=q[3]
                ).insert()
                count += 1
            print(f"   - Seeded {count} {skill} Questions")

        await seed_q(PYTHON_QS, "Python")
        await seed_q(JS_QS, "JavaScript")
        await seed_q(CPP_QS, "C++")
        await seed_q(REACT_QS, "React")

        print("\n🚀 DONE! Login via: http://localhost:8000/auth/dev/Alice")

    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(seed())