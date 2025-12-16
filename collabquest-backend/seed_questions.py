import asyncio
import os
from app.database import init_db
from app.models import Question

if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Dummy Question Bank
PYTHON_QS = [
    # EASY
    ("What is the output of print(2 ** 3)?", ["6", "8", "9", "Error"], 1, "easy"),
    ("Which keyword is used to define a function?", ["func", "def", "function", "define"], 1, "easy"),
    ("What is a tuple?", ["Mutable list", "Immutable list", "Dictionary", "Set"], 1, "easy"),
    ("How do you start a comment?", ["//", "#", "/*", "<!--"], 1, "easy"),
    ("Which is not a valid variable name?", ["my_var", "_var", "2var", "var2"], 2, "easy"),
    
    # MEDIUM
    ("What does the 'pass' keyword do?", ["Stops execution", "Does nothing", "Skips loop", "Returns None"], 1, "medium"),
    ("What is the output of [1, 2] * 2?", ["[1, 2, 2]", "[1, 2, 1, 2]", "[2, 4]", "Error"], 1, "medium"),
    ("Which data structure is LIFO?", ["Queue", "Stack", "List", "Tree"], 1, "medium"),
    ("What is a decorator?", ["A class", "A function that modifies another function", "A variable", "A string"], 1, "medium"),
    ("What is __init__?", ["Constructor", "Destructor", "Import", "Loop"], 0, "medium"),

    # HARD
    ("What is the GIL?", ["Global Interpreter Lock", "General Interface Logic", "Graphical Interface Loop", "None"], 0, "hard"),
    ("What is the difference between @staticmethod and @classmethod?", ["None", "Class method takes cls", "Static method takes cls", "Both take self"], 1, "hard"),
    ("How does Python handle memory management?", ["Manual", "Garbage Collection", "Pointers", "Stack only"], 1, "hard"),
    ("What is a generator?", ["Function yielding values", "List comprehension", "A loop", "A class"], 0, "hard"),
    ("What is MRO?", ["Method Resolution Order", "Memory Read Operation", "Main Runtime Object", "None"], 0, "hard")
]

# (Repeat similar structure for React, Node.js etc. for the demo)

async def seed():
    print("🔌 Connecting...")
    await init_db()
    print("🧹 Clearing old questions...")
    await Question.delete_all()
    
    print("🌱 Seeding Python Questions...")
    for q in PYTHON_QS:
        await Question(
            skill="Python",
            text=q[0],
            options=q[1],
            correct_index=q[2],
            difficulty=q[3]
        ).insert()
        
    # Duplicate for React (Just for hackathon demo purposes, saving time)
    print("🌱 Seeding React Questions (Mock)...")
    for q in PYTHON_QS:
        await Question(
            skill="React",
            text=q[0].replace("Python", "React"), # Lazy hack for demo
            options=q[1],
            correct_index=q[2],
            difficulty=q[3]
        ).insert()

    print("✅ Done!")

if __name__ == "__main__":
    asyncio.run(seed())