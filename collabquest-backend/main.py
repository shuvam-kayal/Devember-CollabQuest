import os
os.environ["FOR_DISABLE_CONSOLE_CTRL_HANDLER"] = "1"
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import init_db

from dotenv import load_dotenv
from app.routes import auth_routes, user_routes, team_routes, match_routes, notification_routes, communication_routes, chat_routes, skill_routes, chatbot_routes

# 1. NEW IMPORT: Bring in the sync function
from app.services.recommendation_service import sync_data_to_chroma

load_dotenv()

app = FastAPI(title="CollabQuest API", version="1.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# --- CORS SETTINGS ---
origins = [
    FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.on_event("startup")
async def start_db():
    await init_db()
    # 2. NEW: Sync the Vector DB immediately on startup
    await sync_data_to_chroma()
    print("✅ Database Connected & Vector Search Ready")

# --- REGISTER ROUTES ---
app.include_router(auth_routes.router, prefix="/auth", tags=["Authentication"])
app.include_router(user_routes.router, prefix="/users", tags=["Users"])
app.include_router(team_routes.router, prefix="/teams", tags=["Teams"])
app.include_router(match_routes.router, prefix="/matches", tags=["Matching"])
app.include_router(notification_routes.router, prefix="/notifications", tags=["Notifications"])
app.include_router(communication_routes.router, prefix="/communication", tags=["Communication"])
app.include_router(chat_routes.router, prefix="/chat", tags=["Chat"])
app.include_router(skill_routes.router, prefix="/skills", tags=["Skills"])
app.include_router(chatbot_routes.router, prefix="/chat/ai", tags=["Chatbot"])

# (Removed the old /rag-chat endpoint because /chat/ai handles everything now)

@app.get("/")
async def root():
    return {"message": "CollabQuest Backend is Running!"}