# CollabQuest AI Instructions

## 🏗 Project Architecture
- **Monorepo Structure**:
  - `collabquest-backend/`: Python FastAPI service handling API, Auth, and Database.
  - `collabquest-frontend/`: Next.js (App Router) application for the UI.
- **Database**: MongoDB Atlas using **Beanie ODM** (asynchronous).
- **Authentication**: GitHub OAuth flow. Backend handles the callback, calculates a "Trust Score", and issues a JWT.

## 🐍 Backend (FastAPI)
- **Entry Point**: `collabquest-backend/main.py`.
- **Database Connection**: Managed in `app/database.py` using `motor` and `beanie`.
  - *Crucial*: Always include `tlsCAFile=certifi.where()` in `AsyncIOMotorClient` to avoid SSL errors.
- **Models**: Defined in `app/models.py` as Beanie `Document` classes.
- **Routing**: Split into `app/routes/` (e.g., `auth_routes.py`, `team_routes.py`).
- **Running**:
  ```bash
  cd collabquest-backend
  # Ensure venv is active
  uvicorn main:app --reload
  ```

## ⚛️ Frontend (Next.js)
- **Framework**: Next.js 14+ (App Router) with TypeScript.
- **Styling**: Tailwind CSS.
- **Icons**: `lucide-react`.
- **Auth Integration**:
  - Login button links directly to backend: `http://localhost:8000/auth/login/github`.
  - Frontend expects a JWT token after the OAuth callback.
- **Running**:
  ```bash
  cd collabquest-frontend
  npm run dev
  ```

## 🔄 Data Flow & Patterns
- **Trust Score**: Calculated during the GitHub OAuth callback (`app/auth/utils.py`).
- **CORS**: Configured in `main.py` to allow `localhost:3000`.
- **Environment Variables**:
  - Backend requires `.env` with `MONGO_URI`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

## ⚠️ Common Pitfalls
- **Async Database**: Remember to use `await` for all Beanie operations (e.g., `await User.find_one(...)`).
- **Next.js Client vs Server**: Use `"use client"` directive for components using hooks like `useState` or `useEffect`.
