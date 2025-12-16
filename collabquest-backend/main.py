from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routes import auth_routes, user_routes, team_routes, match_routes, notification_routes, communication_routes, chat_routes, skill_routes

app = FastAPI(title="CollabQuest API", version="1.0")

# --- CORS SETTINGS ---
# This allows your Next.js frontend to talk to this backend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def start_db():
    await init_db()
    print("✅ Database Connected")

# --- REGISTER ROUTES ---
app.include_router(auth_routes.router, prefix="/auth", tags=["Authentication"])
app.include_router(user_routes.router, prefix="/users", tags=["Users"])
app.include_router(team_routes.router, prefix="/teams", tags=["Teams"])
app.include_router(match_routes.router, prefix="/matches", tags=["Matching"])
app.include_router(notification_routes.router, prefix="/notifications", tags=["Notifications"])
app.include_router(communication_routes.router, prefix="/communication", tags=["Communication"])
app.include_router(chat_routes.router, prefix="/chat", tags=["Chat"])
app.include_router(skill_routes.router, prefix="/skills", tags=["Skills"])

@app.get("/")
async def root():
    return {"message": "CollabQuest Backend is Running!"}