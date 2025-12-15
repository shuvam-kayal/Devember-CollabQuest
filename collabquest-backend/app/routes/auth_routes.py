from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from app.auth.utils import (
    get_github_token, get_github_user, calculate_trust_score, 
    create_access_token, GITHUB_CLIENT_ID, hash_password, verify_password,
    get_google_token, get_google_user, GOOGLE_CLIENT_ID
)
from app.models import User
from app.database import init_db

router = APIRouter()

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
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=read:user"
    )

@router.get("/callback")
async def github_callback(code: str):
    """
    1. GitHub sends back a 'code'
    2. We exchange it for a Token
    3. We fetch their Profile
    4. We calculate Trust Score & Save to DB
    5. We give them a JWT to log in
    """
    token = await get_github_token(code)
    if not token:
        raise HTTPException(status_code=400, detail="GitHub Login Failed")
    
    github_user = await get_github_user(token)
    
    # Check if user exists in DB
    user = await User.find_one(User.github_id == str(github_user["id"]))
    
    if not user:
        # NEW USER: Calculate Score & Create
        trust_score = calculate_trust_score(github_user)
        
        user = User(
            github_id=str(github_user["id"]),
            username=github_user["login"],
            email=github_user.get("email") or "no-email@github.com",
            avatar_url=github_user["avatar_url"],
            trust_score=trust_score,
            is_verified_student=False # They need to verify email later
        )
        await user.insert()
    
    # Generate JWT for the Frontend
    jwt_token = create_access_token({"sub": str(user.id)})
    
    # Redirect back to Frontend with the token
    # In production, use HttpOnly cookies. For hackathon, URL param is fine.
    return RedirectResponse(f"http://localhost:3000/dashboard?token={jwt_token}")

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
    return RedirectResponse(f"http://localhost:3000/dashboard?token={jwt_token}")

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
        f"https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOGLE_CLIENT_ID}&redirect_uri=http://localhost:8000/auth/google/callback&response_type=code&scope=openid profile email"
    )

@router.get("/google/callback")
async def google_callback(code: str):
    """
    Google OAuth callback handler
    1. Exchange code for access token
    2. Fetch user profile
    3. Create or find user in DB
    4. Generate JWT and redirect to frontend
    """
    token = await get_google_token(code, "http://localhost:8000/auth/google/callback")
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
    
    return RedirectResponse(f"http://localhost:3000/dashboard?token={jwt_token}")
