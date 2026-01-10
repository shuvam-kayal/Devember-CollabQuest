# 🚀 CollabQuest - The Smart Team Finder

**CollabQuest** is a platform designed to solve the "Free-Rider Problem" in student hackathons. By leveraging GitHub API data, it calculates a **Trust Score** for every user, ensuring teams are matched based on verified skills and reliability.

## 🛠️ Tech Stack

* **Frontend:** Next.js, Tailwind CSS, Framer Motion
* **Backend:** Python FastAPI, Uvicorn
* **Database:** MongoDB (Beanie ODM)
* **Auth:** GitHub OAuth + JWT

---

## ✅ Prerequisites

Before running this project, ensure you have the following installed on your machine:

* **Node.js** (v18+)
* **Python** (v3.12.0)
* **Git**
* **MongoDB Cluster** (Get a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas/database))

---

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
