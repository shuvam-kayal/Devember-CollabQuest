import asyncio
import os
import sys

# Force UTF-8 encoding for stdout (Windows fix)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
from app.database import init_db
from app.models import User, Team, Swipe, Match, Notification, Message, ChatGroup, Question, Block, UnreadCount

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

    
    print("🧹 Deleting Questions...")
    await Question.delete_all()

    print("🧹 Deleting Blocks...")
    await Block.delete_all()

    print("🧹 Deleting Notifications...")
    await Notification.delete_all()

    print("🧹 Deleting Unread Counts...")
    await UnreadCount.delete_all()
    
    print("✨ Database is sparkling clean!")

if __name__ == "__main__":
    asyncio.run(clean())