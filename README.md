# HelpDesk AI 🤖

A full-stack, AI-powered help desk platform with user authentication, persistent chat history, and intelligent answers powered by **Google Gemini Flash**.

---

## 📸 Features

| Feature | Details |
|---|---|
| 🔐 Authentication | JWT-based login & registration |
| 💬 AI Chat | Google Gemini Flash (gemini-1.5-flash) |
| 🗂️ Chat History | Per-user sessions stored in PostgreSQL |
| 📚 Source References | Responses cite docs & best practices |
| 🌙 Markdown Rendering | Code blocks, tables, lists rendered beautifully |
| 🐳 Docker Ready | One-command deployment |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router v6, Axios |
| **AI** | Google Gemini Flash (`gemini-1.5-flash`) |
| **Backend** | FastAPI (Python 3.11), SQLAlchemy (async) |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT (python-jose) + bcrypt |
| **Deployment** | Docker + Docker Compose |

---

## 📁 Project Structure

```
helpdesk/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment variable template
│   ├── Dockerfile
│   ├── middleware/
│   │   └── auth.py           # JWT auth helpers
│   ├── models/
│   │   ├── database.py       # SQLAlchemy ORM models
│   │   └── db.py             # DB engine & session
│   ├── routes/
│   │   ├── auth.py           # /api/auth/* endpoints
│   │   └── chat.py           # /api/chat/* endpoints
│   └── services/
│       └── ai_service.py     # Gemini AI integration
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── App.js            # Router & layout
│       ├── App.css           # Global styles
│       ├── index.js
│       ├── context/
│       │   └── AuthContext.js  # Auth state & API client
│       ├── pages/
│       │   ├── LoginPage.js
│       │   ├── RegisterPage.js
│       │   └── DashboardPage.js  # Main chat UI
│       └── components/
│           └── ChatMessage.js    # Message bubble + markdown
├── docker-compose.yml
├── setup.sh          (Linux/macOS)
├── setup_windows.bat (Windows)
└── README.md
```

---

## ⚙️ Prerequisites

Install these before starting:

| Software | Version | Download |
|---|---|---|
| **Python** | 3.10+ | https://python.org/downloads |
| **Node.js** | 18+ | https://nodejs.org |
| **PostgreSQL** | 14+ | https://postgresql.org/download |
| **Git** | Any | https://git-scm.com |

---

## 🚀 Quick Start (Step-by-Step)

### Step 1 — Get a Gemini API Key (FREE)

1. Go to **https://makersuite.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API key"**
4. Copy the key — you'll need it in Step 3

---

### Step 2 — Set Up PostgreSQL Database

#### On Windows:
1. Download PostgreSQL from https://postgresql.org/download/windows
2. Install with default settings (remember your password!)
3. Open **pgAdmin** or **psql** and run:

```sql
CREATE DATABASE helpdesk_db;
```

#### On macOS:
```bash
brew install postgresql@16
brew services start postgresql@16
psql postgres -c "CREATE DATABASE helpdesk_db;"
```

#### On Ubuntu/Debian:
```bash
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE helpdesk_db;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'yourpassword';"
```

---

### Step 3 — Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Your PostgreSQL connection string
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/helpdesk_db

# JWT secret — use any long random string
SECRET_KEY=my-super-secret-key-change-this-12345

ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Your Gemini API key from Step 1
GEMINI_API_KEY=AIzaSy...your-key-here

# Server settings
APP_HOST=0.0.0.0
APP_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

---

### Step 4 — Run the Automated Setup

#### Linux / macOS:
```bash
chmod +x setup.sh
./setup.sh
```

#### Windows:
Double-click `setup_windows.bat` or run in Command Prompt:
```
setup_windows.bat
```

The script will:
- Create a Python virtual environment
- Install all Python packages
- Install all Node.js packages

---

### Step 5 — Start the Backend

Open **Terminal 1**:

```bash
cd backend

# Activate virtual environment
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Start the server
python main.py
```

You should see:
```
🚀 Starting HelpDesk AI Backend...
✅ Gemini model initialized
✅ Database tables created successfully
✅ Server ready at http://localhost:8000
📚 API Docs: http://localhost:8000/api/docs
```

---

### Step 6 — Start the Frontend

Open **Terminal 2**:

```bash
cd frontend
npm start
```

Browser opens automatically at **http://localhost:3000** 🎉

---

## 🐳 Docker Deployment (Alternative)

If you have Docker Desktop installed, you can run everything with one command:

```bash
# 1. Create a .env file at project root:
echo "GEMINI_API_KEY=your-key-here" > .env
echo "SECRET_KEY=your-secret-key-here" >> .env

# 2. Start all services
docker-compose up --build

# 3. Open http://localhost:3000
```

To stop:
```bash
docker-compose down
```

To stop and delete database data:
```bash
docker-compose down -v
```

---

## 🔌 API Reference

All endpoints are available at `http://localhost:8000/api`

Interactive docs: **http://localhost:8000/api/docs**

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login & get JWT token |
| GET | `/api/me` | Get current user profile |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat/send` | Send a message, get AI response |
| GET | `/api/chat/sessions` | List all user's chat sessions |
| GET | `/api/chat/sessions/{id}/messages` | Load messages in a session |
| DELETE | `/api/chat/sessions/{id}` | Delete a chat session |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check server status |

---

## 🗄️ Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Chat sessions (one per conversation thread)
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Individual messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,   -- 'user' or 'assistant'
    content TEXT NOT NULL,
    sources TEXT,                -- JSON array of source strings
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

> Tables are created **automatically** on first backend startup — no manual SQL needed.

---

## 🔧 Troubleshooting

### ❌ "GEMINI_API_KEY not set" / Demo mode
- Make sure you set `GEMINI_API_KEY` in `backend/.env`
- Restart the backend after editing `.env`
- Test your key at https://makersuite.google.com

### ❌ Database connection error
```
asyncpg.exceptions.InvalidCatalogNameError: database "helpdesk_db" does not exist
```
- Create the database: `CREATE DATABASE helpdesk_db;`
- Check your `DATABASE_URL` in `.env` — password, port, host must all match

### ❌ CORS error in browser
- Ensure `CORS_ORIGINS=http://localhost:3000` is in `backend/.env`
- Backend must be running on port 8000
- Do not add trailing slash to CORS_ORIGINS

### ❌ npm install fails
```bash
node --version   # Must be 18+
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### ❌ Python import errors
```bash
# Make sure venv is activated
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### ❌ Port already in use
```bash
# Kill process on port 8000 (Linux/macOS)
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```

---

## 🔒 Security Notes

- Change `SECRET_KEY` to a long random string before any real deployment
- Never commit your `.env` file to git (it's already in `.gitignore`)
- Use HTTPS in production (add a reverse proxy like Nginx or Caddy)
- Rotate your Gemini API key if you suspect it's been exposed

---

## 📦 Adding Your Own Documents (RAG)

To make the AI answer from your custom PDFs or documents:

1. Place PDF files in `backend/uploads/`
2. The `ai_service.py` can be extended with `langchain` + `chromadb` (already in requirements) to:
   - Parse PDFs with `PyPDF2`
   - Embed with `sentence-transformers`
   - Store in ChromaDB vector store
   - Retrieve relevant chunks before each Gemini call

This gives the bot context from your own documentation. Ask for this extension if needed!

---

## 📄 License

MIT — free to use, modify, and distribute.
