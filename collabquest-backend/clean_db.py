import asyncio
import os
from app.database import init_db
from app.models import User, Team, Swipe, Match, Notification

# --- WINDOWS FIX ---
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def clean():
    print("🔌 Connecting to Database...")
    await init_db()
    
    print("🧹 Deleting ALL Users...")
    await User.delete_all()
    
    print("🧹 Deleting ALL Teams...")
    await Team.delete_all()
    
    print("🧹 Deleting ALL Swipes...")
    await Swipe.delete_all()
    
    print("🧹 Deleting ALL Matches...")
    await Match.delete_all()
    
    print("🧹 Deleting ALL Notifications...")
    await Notification.delete_all()
    
    print("✨ Database is now empty and sparkling clean!")

if __name__ == "__main__":
    asyncio.run(clean())