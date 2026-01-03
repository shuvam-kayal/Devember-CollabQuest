🚀 CollabQuest - The Smart Team Finder

CollabQuest is a platform that solves the "Free-Rider Problem" in student hackathons. It uses GitHub API data to calculate a Trust Score for every user, ensuring teams are matched based on verified skills and reliability.

🛠️ Tech Stack

Frontend: Next.js, Tailwind CSS, Framer Motion

Backend: Python FastAPI, Uvicorn



Database: MongoDB (Beanie ODM)


Auth: GitHub OAuth + JWT

✅ Prerequisites (What you need installed)

Before running this project, ensure you have the following installed on your machine:

Node.js (v18+)

Python (v3.12.0)

Git

MongoDB URI -> Get a free cluster at MongoDB Atlas

🚀 Getting Started

1. Clone the Repository

git clone [https://github.com/your-username/collabquest.git](https://github.com/your-username/collabquest.git)
cd collabquest


2. Backend Setup (Python)

Open a terminal and navigate to the backend folder:

cd collabquest-backend

# Create a virtual environment (Windows)
python -m venv venv
.\venv\Scripts\activate

# Create a virtual environment (Mac/Linux)
# python3 -m venv venv
# source venv/bin/activate

# Install dependencies

Create this requirements.txt
'''
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
'''

Then run:
pip install -r requirements.txt


Configure Secrets:
Create a file named .env inside collabquest-backend/ and paste this:

MONGO_URI=mongodb+srv://<your_user>:<your_pass>@cluster0.mongodb.net/?retryWrites=true&w=majority
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
SECRET_KEY=any_random_secret_string
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FRONTEND_URL=http://localhost:3000 (or your production URL)
API_URL=http://localhost:8000 (or your production URL)
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password_here
MAIL_FROM=your_email@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_FROM_NAME="CollabQuest Team"
OPENROUTER_API_KEY=your_openrouter_api_key

Run the Server:
uvicorn main:app --reload

# Server running at http://localhost:8000


3. Frontend Setup (Next.js)

Open a new terminal and navigate to the frontend folder:

cd collabquest-frontend

# Install dependencies
npm install framer-motion lucide-react js-cookie axios
npm install -D @types/js-cookie
npm install --save-dev @types/js-cookie
npm install zod
npm install react-markdown
npm install react-hot-toast

Create a file named .env.local inside collabquest-frontend/ and paste this:

NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# When using a Tunnel (Comment out the above and uncomment this)
NEXT_PUBLIC_API_URL=https://your-backend-tunnel.ngrok-free.app
NEXT_PUBLIC_WS_URL=wss://your-backend-tunnel.ngrok-free.app

# Run the frontend
npm run dev
# App running at http://localhost:3000


🔑 How to get GitHub OAuth Keys

Go to GitHub Developer Settings.

Click New OAuth App.

Set Homepage URL to http://localhost:3000 (or your production URL).

Set Authorization Callback URL to http://localhost:8000/auth/callback.

Copy the Client ID and generate a Client Secret into your .env file.

🧪 Testing the App

Open http://localhost:3000 in your browser.

Click "Login with GitHub".

You should be redirected to your Dashboard with a calculated Trust Score.

Note:

Reset Data (If things get messy):

python clean_db.py (Wipe DB)

python seed_data.py (Create fresh dummy users/projects)
