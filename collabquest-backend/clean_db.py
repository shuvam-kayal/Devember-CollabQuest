import asyncio
import os
from app.database import init_db
from app.models import User, Team, Swipe, Match, Notification, Message, ChatGroup

# Windows Fix
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def clean():
    print("🔌 Connecting to Database...")
    await init_db()
    
    print("🧹 Deleting Users...")
    await User.delete_all()
    
    print("🧹 Deleting Teams...")
    await Team.delete_all()
    
    print("🧹 Deleting Swipes & Matches...")
    await Swipe.delete_all()
    await Match.delete_all()
    
    print("🧹 Deleting Messages & Groups...")
    await Message.delete_all()
    await ChatGroup.delete_all()
    
    print("🧹 Deleting Notifications...")
    await Notification.delete_all()
    
    print("✨ Database is sparkling clean!")

if __name__ == "__main__":
    asyncio.run(clean())