import os
import httpx
import bcrypt
from datetime import datetime, timedelta
from jose import jwt
from dotenv import load_dotenv
from jose.exceptions import JWTError

load_dotenv()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

# --- HEADERS TO MIMIC A BROWSER ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, application/xhtml+xml, application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

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

async def update_trust_score(user):
    """
    Unified Scoring Engine.
    Calculates all boosts and updates user.trust_score and user.trust_score_breakdown.
    """
    breakdown = user.trust_score_breakdown
    if not breakdown:
        # Initialize if it doesn't exist
        from models import TrustBreakdown
        breakdown = TrustBreakdown()

    # 1. Reset dynamic fields (Keep breakdown.base which is usually 5.0)
    breakdown.details = []
    breakdown.github = 0.0
    breakdown.linkedin = 0.0
    breakdown.codeforces = 0.0
    breakdown.leetcode = 0.0

    # 2. GitHub Boost (Max 1.5)
    github_stats = user.platform_stats.get("github")
    if github_stats:
        public_repos = github_stats.get("public_repos", 0)
        followers = github_stats.get("followers", 0)
        created_at_str = github_stats.get("created_at")
        
        # Age Logic
        age_years = 0
        if created_at_str:
            try:
                created_at = datetime.strptime(created_at_str, "%Y-%m-%dT%H:%M:%SZ")
                age_years = (datetime.now() - created_at).days / 365
            except: pass

        repo_pts = min(0.5, public_repos * 0.02)
        follow_pts = min(0.5, followers * 0.05)
        age_pts = min(0.5, age_years * 0.2)
        
        breakdown.github = round(repo_pts + follow_pts + age_pts, 1)
        breakdown.details.append(f"GitHub: {public_repos} Repos, {followers} Followers (+{breakdown.github})")

    # 2. Codeforces (Max 0.2)
    if user.connected_accounts.codeforces:
        stats = user.platform_stats.get("codeforces")
        if not stats:
             stats = await fetch_codeforces_stats(user.connected_accounts.codeforces)
             
        if stats and "rating" in stats and stats["rating"] != "Unrated":
            rating = stats["rating"]
            points = 0.0
            if rating >= 1000: points = 0.1
            if rating >= 1400: points = 0.2
            
            breakdown.codeforces = points
            breakdown.details.append(f"Codeforces: Rating {rating} (+{points})")
            
    # 3. LeetCode (Max 0.2)
    if user.connected_accounts.leetcode:
        stats = user.platform_stats.get("leetcode")
        if not stats:
            stats = await fetch_leetcode_stats(user.connected_accounts.leetcode)

        if stats and "total_solved" in stats:
            total_solved = stats["total_solved"]
            points = 0.0
            if total_solved >= 50: points = 0.1
            if total_solved >= 200: points = 0.2
            
            breakdown.leetcode = points
            breakdown.details.append(f"LeetCode: {total_solved} Solved (+{points})")

    # Modified Step 4
    linkedin_connected = user.connected_accounts.get("linkedin")
    linkedin_in_links = any("linkedin.com" in str(link.url) for link in user.professional_links)

    if linkedin_connected or linkedin_in_links:
        breakdown.linkedin = 0.1
        breakdown.details.append("LinkedIn: Verified or Linked (+0.1)")

    # 6. Final Summation
    total = (
        breakdown.base + 
        breakdown.github + 
        breakdown.linkedin + 
        breakdown.codeforces + 
        breakdown.leetcode
    )
    
    user.trust_score = round(total, 1)
    user.trust_score_breakdown = breakdown
    # We do NOT call user.save() here to avoid infinite loops; 
    # the calling function should handle the save.
    return user

async def fetch_codeforces_stats(handle: str):
    """Fetches user stats from Codeforces API to verify existence and score."""
    url = f"https://codeforces.com/api/user.info?handles={handle}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=HEADERS, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                if data["status"] == "OK":
                    return data["result"][0]
        except Exception as e:
            print(f"Codeforces Fetch Error: {e}")
            pass
    return None

async def fetch_leetcode_stats(username: str):
    """Fetches user stats from LeetCode GraphQL API."""
    url = "https://leetcode.com/graphql"
    query = """
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        username
        submitStats: submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
    """
    lc_headers = HEADERS.copy()
    lc_headers["Referer"] = f"https://leetcode.com/{username}/"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                url, 
                json={"query": query, "variables": {"username": username}}, 
                headers=lc_headers, 
                timeout=10.0
            )
            if resp.status_code == 200:
                data = resp.json()
                if "data" in data and data["data"] and data["data"]["matchedUser"]:
                    return data["data"]["matchedUser"]
        except Exception as e:
            print(f"LeetCode Fetch Error: {e}")
            pass
    return None

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def hash_password(password: str) -> str:
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password[:72].encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)

async def get_google_token(code: str, redirect_uri: str):
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
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers=headers
        )
        return response.json()
    
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None