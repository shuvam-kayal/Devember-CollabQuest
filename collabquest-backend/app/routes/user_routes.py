from fastapi import APIRouter, Depends
from app.models import User
from app.auth.dependencies import get_current_user

router = APIRouter()

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Fetch the currently logged-in user's profile.
    This is protected - you MUST have a valid token to access it.
    """
    return current_user