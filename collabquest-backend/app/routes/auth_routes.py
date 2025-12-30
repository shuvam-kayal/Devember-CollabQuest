from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from app.auth.utils import (
    get_github_token, get_github_user, update_trust_score, 
    create_access_token, GITHUB_CLIENT_ID, hash_password, verify_password,
    get_google_token, get_google_user, GOOGLE_CLIENT_ID, verify_token
)
from app.models import User, TrustBreakdown, ConnectedAccounts
from app.database import init_db
from typing import Optional
import os
import traceback
from dotenv import load_dotenv

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
API_URL = os.getenv("API_URL", "http://localhost:8000")

# --- REQUEST MODELS ---
class EmailRegisterRequest(BaseModel):
    email: str
    username: str
    password: str

class EmailLoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user_id: str
    username: str
    email: str

@router.get("/login/github")
async def github_login():
    """Redirects the user to GitHub to sign in"""
    # ADDED user:email scope here
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=read:user user:email"
    )

@router.get("/link/github")
async def link_github(token: str):
    """
    Initiates GitHub OAuth flow for linking an account to an EXISTING user.
    """
    # FIX: Check if payload is returned, otherwise raise exception
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid session")
        
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=read:user user:email&state={token}"
    )

@router.get("/callback")
async def github_callback(code: str, state: Optional[str] = None):
    token = await get_github_token(code)
    if not token:
        raise HTTPException(status_code=400, detail="GitHub Login Failed")
    
    # Always fetch fresh data from GitHub API
    github_user = await get_github_user(token)
    if not github_user:
        raise HTTPException(status_code=400, detail="Failed to fetch GitHub profile")

    github_id_str = str(github_user["id"])

    # --- LINKING FLOW (If state/token is present) ---
    if state:
        try:
            payload = verify_token(state)
            current_user_id = payload.get("sub")
            user = await User.get(current_user_id)
            
            if user:
                # 1. Check if this GitHub account is already linked to ANOTHER user
                conflict = await User.find_one(User.github_id == github_id_str)
                if conflict and str(conflict.id) != str(user.id):
                    return RedirectResponse(f"{FRONTEND_URL}/profile?error=github_taken")

                # 2. Link Account
                user.github_id = github_id_str
                
                # 3. Update Connected Accounts
                if not user.connected_accounts: 
                    user.connected_accounts = ConnectedAccounts()
                user.connected_accounts.github = github_user["login"]
                
                # 4. Fill Data from GitHub (Only if missing)
                if not user.avatar_url:
                    user.avatar_url = github_user["avatar_url"]
                
                if not user.full_name and github_user.get("name"):
                    user.full_name = github_user["name"]
                    
                if (not user.about or user.about == "I love building cool things!") and github_user.get("bio"):
                    user.about = github_user["bio"]

                # 5. Update Stats & Trust Score
                if not user.platform_stats: 
                    user.platform_stats = {}
                user.platform_stats["github"] = github_user
                
                await update_trust_score(user)
                await user.save()
                
                return RedirectResponse(f"{FRONTEND_URL}/profile?success=github_linked")
        except Exception as e:
            print(f"Linking Error: {e}")
            traceback.print_exc()
            return RedirectResponse(f"{FRONTEND_URL}/profile?error=linking_failed")
    
    # Check if user exists in DB
    user = await User.find_one(User.github_id == github_id_str)
    
    if not user:
        # 1. NEW USER PATH
        # Create empty breakdown first
        user = User(
            github_id=github_id_str,
            username=github_user["login"],
            # Fallback is now less likely to happen
            email=github_user.get("email") or "no-email@github.com",
            avatar_url=github_user["avatar_url"],
            connected_accounts={"github": github_user["login"]}, # Ensure this exists
            platform_stats={"github": github_user}
        )
        # Note: We don't insert yet, we calculate score first
    else:
        # 2. RETURNING USER PATH: Sync fresh GitHub data
        user.username = github_user["login"]
        user.avatar_url = github_user["avatar_url"]
        if github_user.get("email"):
            user.email = github_user["email"]
        
        # Update the stats bucket so update_trust_score sees the new repo counts/followers
        if not user.platform_stats:
            user.platform_stats = {}
        user.platform_stats["github"] = github_user

    # 3. UNIFIED CALCULATION (Runs for both New and Returning)
    # This ensures GitHub, LinkedIn, CF, and LeetCode are all recalculated
    await update_trust_score(user) 
    
    # 4. SAVE TO DB
    if hasattr(user, 'id') and user.id:
        await user.save() # Update existing
    else:
        await user.insert() # Insert new
    
    # Generate JWT for the Frontend
    jwt_token = create_access_token({"sub": str(user.id)})
    
    return RedirectResponse(f"{FRONTEND_URL}/dashboard?token={jwt_token}")

@router.get("/dev/{username}")
async def dev_login(username: str):
    """
    Hackathon Backdoor: Log in as any seeded user (e.g., 'Alice') 
    without GitHub authentication.
    """
    # 1. Find the fake user
    user = await User.find_one(User.username == username)
    
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found. Did you run seed_data.py?")
    
    # 2. Generate a real JWT for them
    jwt_token = create_access_token({"sub": str(user.id)})
    
    # 3. Redirect to Frontend just like a real login
    return RedirectResponse(f"{FRONTEND_URL}/dashboard?token={jwt_token}")

# --- EMAIL & PASSWORD AUTH ---

@router.post("/register/email", response_model=AuthResponse)
async def register_email(request: EmailRegisterRequest):
    """
    Register a new user with email and password
    """
    # Check if email already exists
    existing_email = await User.find_one(User.email == request.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists
    existing_username = await User.find_one(User.username == request.username)
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Validate password strength (at least 6 characters)
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Create new user
    password_hash = hash_password(request.password)
    user = User(
        username=request.username,
        email=request.email,
        password_hash=password_hash,
        github_id=None,
        auth_method="email",
        trust_score=5.0,
        is_verified_student=False
    )
    await user.insert()
    
    # Generate JWT
    jwt_token = create_access_token({"sub": str(user.id)})
    
    return AuthResponse(
        token=jwt_token,
        user_id=str(user.id),
        username=user.username,
        email=user.email
    )

@router.post("/login/email", response_model=AuthResponse)
async def login_email(request: EmailLoginRequest):
    """
    Log in with email and password
    """
    # Find user by email
    user = await User.find_one(User.email == request.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Generate JWT
    jwt_token = create_access_token({"sub": str(user.id)})
    
    return AuthResponse(
        token=jwt_token,
        user_id=str(user.id),
        username=user.username,
        email=user.email
    )

# --- GOOGLE AUTH ---

@router.get("/login/google")
async def google_login():
    """Redirect user to Google OAuth consent screen"""
    return RedirectResponse(
        f"https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOGLE_CLIENT_ID}&redirect_uri={API_URL}/auth/google/callback&response_type=code&scope=openid profile email"
    )

@router.get("/google/callback")
async def google_callback(code: str):
    """
    Google OAuth callback handler
    """
    token = await get_google_token(code, API_URL + "/auth/google/callback")
    if not token:
        raise HTTPException(status_code=400, detail="Google Login Failed")
    
    google_user = await get_google_user(token)
    
    # Check if user exists by email
    user = await User.find_one(User.email == google_user["email"])
    
    if not user:
        # NEW USER: Create account
        user = User(
            google_id=str(google_user.get("id", "")),
            username=google_user.get("name", "").replace(" ", "_").lower(),
            email=google_user["email"],
            avatar_url=google_user.get("picture"),
            github_id=None,
            auth_method="google",
            trust_score=5.0,
            is_verified_student=False
        )
        await user.insert()
    
    # Generate JWT
    jwt_token = create_access_token({"sub": str(user.id)})
    
    return RedirectResponse(f"{FRONTEND_URL}/dashboard?token={jwt_token}")