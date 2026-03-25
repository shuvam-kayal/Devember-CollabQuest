# 🚀 CollabQuest - The Smart Team Finder

> **QuadCore Clowns**

**CollabQuest** is a full-stack collaborative platform designed to solve the "Free-Rider Problem" in student hackathons and academic projects. Unlike traditional listing platforms, it utilizes a **Smart Match** system backed by vector embeddings and a comprehensive **Trust Score** to ensure teams are formed based on verified skills, compatibility, and reliability.

---

## 🌐 Live Deployment

* **Frontend (Vercel):** [https://devember-collab-quest.vercel.app/](https://devember-collab-quest.vercel.app/)
* **Backend (Hugging Face):** [https://shuvam-kayal-collabquest-backend.hf.space/](https://shuvam-kayal-collabquest-backend.hf.space/)

---

## 🛠️ Tech Stack

### Frontend (Client-Side)
* **Framework:** Next.js 16.0.7 (App Router) & React 19.2.0
* **Styling:** Tailwind CSS v4, clsx, tailwind-merge
* **Animation:** Framer Motion v12 (Physics-based transitions)
* **State & Validation:** React Hook Form, Zod, Sonner (Toast notifications)
* **Real-Time:** WebRTC (Video/Audio) & Socket.io (Signaling)

### Backend (Server-Side)
* **Framework:** Python FastAPI, Uvicorn
* **Database:** MongoDB (via Beanie ODM) & ChromaDB (Vector Database)
* **AI & Logic:** LangChain, LangGraph, Sentence-Transformers (all-MiniLM-L6-v2)
* **Auth:** GitHub/Google OAuth + JWT (Python-JOSE), Passlib (Bcrypt)

---

## ✨ Key Features

### 1. Smart Match System ("Tinder for Devs")
Uses vector embeddings to replace keyword searching with semantic understanding.
* **Vector Embeddings:** Generates 384-dimensional vectors for user bio/skills and project descriptions.
* **Scoring Algorithm:**
    * *70% Semantic Compatibility:* Skill matches and context alignment.
    * *30% Availability Overlap:* Logistical schedule matching.
* **Interaction:** Physics-based swipe interface (Left/Right) with keyboard accessibility.

### 2. Trust & Verification Engine
* **Trust Score (0-7.0):** A calculated metric derived from verified external data (GitHub commits, LeetCode solutions) and internal peer ratings.
* **Skill Verification:** Users can take timed quizzes to earn "Expert" or "Advanced" badges on their profile.

### 3. Integrated Collaboration Suite
* **Real-Time Chat:** Persistent chat history with file sharing support.
* **Video Conferencing:** Built-in WebRTC suite supporting screen sharing and toggleable video/audio—no external tools required.
* **Team Dashboard:** Features a democratic "Notice Board" where critical actions (like removing a member) require a voting supermajority.

### 4. AI Project Manager (CollabBot)
A multi-agent system powered by LangGraph with three specialized nodes:
* **Router:** Classifies intent (`nvidia/nemotron-3-nano`).
* **Mentor:** Generates roadmaps and advice (`llama-3.3-70b`).
* **Coder:** Assists with snippets and debugging (`xiaomi/mimo-v2`).

### 5. Accessibility First
* **Global TTS:** A Text-to-Speech engine runs across the entire application. Users can highlight any text (chat, docs, code) to hear it read aloud immediately.

---

## 📂 Project Structure

This project follows a monorepo structure containing both the Next.js frontend and FastAPI backend.

```text
DEVEMBER-CQ/
├── .github/
├── .vercel/
├── collabquest-backend/                 # FastAPI Server
│   ├── app/
│   │   ├── auth/                        # OAuth & JWT handling
│   │   ├── routes/                      # API Endpoints (matches, users, teams)
│   │   ├── services/                    # Business logic layers
│   │   ├── database.py                  # MongoDB (Beanie) connection
│   │   └── models.py                    # Pydantic/Beanie models
│   ├── chroma_db_matching/              # Vector Search & Semantic Matching
│   ├── uploads/                         # Static file storage
│   ├── clean_db.py
│   ├── main.py                          # App Entry Point
│   ├── requirements.txt
│   └── seeding_data.py
│
└── collabquest-frontend/                # Next.js 16 Application
    ├── ai_services/                     # LangGraph/AI integration
    ├── app/
    │   ├── (authgp)/                    # Login/Signup Groups
    │   ├── (working)/                   # Protected Routes (Chat, Find Team, Profile)
    │   └── dashboard/                   # Main User Dashboard
    ├── components/
    │   ├── Chatbot.tsx                  # AI Project Manager UI
    │   ├── SelectionTTS.tsx             # Global Accessibility Engine
    │   ├── Sidebar.tsx                  # Smart Sidebar
    │   └── ...
    ├── lib/
    ├── middleware.ts                    # Edge Security
    └── package.json

```

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone [https://github.com/your-username/collabquest.git](https://github.com/your-username/collabquest.git)
cd collabquest
```

### 2. Backend Setup (Python)

Open a terminal and navigate to the backend folder:

```bash
cd collabquest-backend
```

**Set up the Virtual Environment:**

* **Windows:**
    ```bash
    python -m venv venv
    .\venv\Scripts\activate
    ```

* **Mac/Linux:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

**Install Dependencies:**

First, create a file named `requirements.txt` in the `collabquest-backend/` directory with the following content:

```text
fastapi>=0.100.0
uvicorn[standard]>=0.23.0
motor>=3.3.0
beanie>=1.21.0
pydantic>=2.0.0
python-dotenv>=1.0.0
httpx>=0.24.0
python-jose[cryptography]>=3.3.0
certifi>=2023.7.22
email-validator>=2.0.0
google-generativeai
```

Then, run the installation command:

```bash
pip install -r requirements.txt
```

**Configure Secrets:**

Create a `.env` file inside `collabquest-backend/` and paste the following configuration. Replace the placeholders with your actual keys.

```env
MONGO_URI=mongodb+srv://<your_user>:<your_pass>@cluster0.mongodb.net/?retryWrites=true&w=majority
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
SECRET_KEY=any_random_secret_string
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:8000
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password_here
MAIL_FROM=your_email@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_FROM_NAME="CollabQuest Team"
OPENROUTER_API_KEY=your_openrouter_api_key
```

**Run the Server:**

```bash
uvicorn main:app --reload
```
*The backend should now be running at `http://localhost:8000`.*

---

### 3. Frontend Setup (Next.js)

Open a **new** terminal window and navigate to the frontend folder:

```bash
cd collabquest-frontend
```

**Install Dependencies:**

```bash
npm install framer-motion lucide-react js-cookie axios zod react-markdown react-hot-toast
npm install -D @types/js-cookie
```

**Configure Environment:**

Create a `.env.local` file inside `collabquest-frontend/` and add the following:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# OPTIONAL: If using a tunneling service (e.g., ngrok), uncomment below:
# NEXT_PUBLIC_API_URL=[https://your-backend-tunnel.ngrok-free.app](https://your-backend-tunnel.ngrok-free.app)
# NEXT_PUBLIC_WS_URL=wss://your-backend-tunnel.ngrok-free.app
```

**Run the Frontend:**

```bash
npm run dev
```
*The app should now be running at `http://localhost:3000`.*

---

## 🔑 How to Get GitHub OAuth Keys

1.  Go to **GitHub Developer Settings** > **OAuth Apps**.
2.  Click **New OAuth App**.
3.  **Application Name:** CollabQuest (or your preference).
4.  **Homepage URL:** `http://localhost:3000` (or your production URL).
5.  **Authorization Callback URL:** `http://localhost:8000/auth/callback`.
6.  Click **Register Application**.
7.  Copy the **Client ID** and generate a **Client Secret**, then paste them into your backend `.env` file.

---

## 🧪 Testing & Maintenance

**To Test the App:**
1.  Open `http://localhost:3000` in your browser.
2.  Click **"Login with GitHub"**.
3.  You should be redirected to your Dashboard with a calculated Trust Score.

**Database Utilities:**
If you need to reset the data, ensure your virtual environment is active and run:

```bash
# Wipe the database
python clean_db.py

# Create fresh dummy users/projects
python seed_data.py
```

---

## 🔮 Future Enhancements

1. AI-based resume analysis.
2. Direct GitHub Issue integration in the dashboard.
3. Dedicated mobile application.
