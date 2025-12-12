from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from app.auth.utils import get_github_token, get_github_user, calculate_trust_score, create_access_token, GITHUB_CLIENT_ID
from app.models import User
from app.database import init_db

router = APIRouter()

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
