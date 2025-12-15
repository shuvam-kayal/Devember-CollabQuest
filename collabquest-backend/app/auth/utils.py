import os
import httpx
import bcrypt
from datetime import datetime, timedelta
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

async def get_github_token(code: str):
    """Exchange the login code for a permanent access token"""
    url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    data = {
        "client_id": GITHUB_CLIENT_ID,
        "client_secret": GITHUB_CLIENT_SECRET,
        "code": code
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        return response.json().get("access_token")

async def get_github_user(token: str):
    """Fetch user profile using the access token"""
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.get("https://api.github.com/user", headers=headers)
        return response.json()

def calculate_trust_score(github_data: dict) -> float:
    """
    Hackathon Magic: Calculate 'Trust' based on GitHub stats.
    Formula: Base 5 + (Repos * 0.1) + (Followers * 0.2) + (Account Age Bonus)
    Max Score: 10.0
    """
    base_score = 5.0
    
    # Extract stats
    public_repos = github_data.get("public_repos", 0)
    followers = github_data.get("followers", 0)
    created_at = datetime.strptime(github_data.get("created_at"), "%Y-%m-%dT%H:%M:%SZ")
    account_age_years = (datetime.now() - created_at).days / 365
    
    # Calculate Bonus
    repo_points = min(2.0, public_repos * 0.1) # Max 2 points for repos
    follower_points = min(2.0, followers * 0.2) # Max 2 points for followers
    age_points = min(1.0, account_age_years * 0.5) # Max 1 point for age
    
    total = base_score + repo_points + follower_points + age_points
    return round(min(10.0, total), 1)

def create_access_token(data: dict):
    """Create a JWT token for our frontend to use"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7) # Token lasts 7 days
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    # Truncate password to 72 bytes (bcrypt limit) and hash
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    # Truncate password to 72 bytes (bcrypt limit) and verify
    password_bytes = plain_password[:72].encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)

async def get_google_token(code: str, redirect_uri: str):
    """Exchange Google authorization code for access token"""
    url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data)
        return response.json().get("access_token")

async def get_google_user(token: str):
    """Fetch user profile from Google using access token"""
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers=headers
        )
        return response.json()