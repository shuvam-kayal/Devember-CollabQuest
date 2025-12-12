import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models import User, Team, Swipe, Match, Notification 
from dotenv import load_dotenv

load_dotenv()

async def init_db():
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("❌ Error: MONGO_URI is missing in .env")
        return

    # TLS Fix: explicit CA bundle
    client = AsyncIOMotorClient(
        mongo_uri,
        tlsCAFile=certifi.where()
    )
    
    # Initialize Beanie with our models
    # database_name is 'collabquest_db'
    await init_beanie(database=client.collabquest_db, document_models=[User, Team, Swipe, Match, Notification])
    print("✅ Connected to MongoDB Atlas")