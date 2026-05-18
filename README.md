# HelpDesk AI
A production-grade, full-stack AI helpdesk platform engineered on **FastAPI** and **React 18** — dual-powered by **Ollama (Llama 3.1)** for fully local inference and **Google Gemini Flash** as cloud fallback, with **RAG (Retrieval-Augmented Generation)** over a live **ChromaDB** vector store and **sentence-transformers** for semantic embeddings — where admins dynamically inject SOPs and policy documents into the knowledge base in real time, and users get precise, source-cited, context-grounded answers instantly, all secured behind **JWT authentication**, role-based access control, and a fully responsive **PostgreSQL**-backed, markdown-rendering chat UI — deployable in one command via **Docker Compose**.

---
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
| **AI** | Google Gemini Flash (`gemini-2.5-flash`) |
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
## Prerequisites

Install these first:
- [Python 3.10+](https://python.org/downloads) — ✅ check "Add to PATH" during install
- [Node.js 18+](https://nodejs.org)
- [PostgreSQL 14+](https://postgresql.org/download/windows) — remember your password
- [Git](https://git-scm.com)

---

## Setup (Windows)

### 1. Create the database

Open **pgAdmin** or **psql** and run:
```sql
CREATE DATABASE helpdesk_db;
```

---

### 2. Get a Gemini API Key (free)

Go to https://makersuite.google.com/app/apikey → Create API key → Copy it

---

### 3. Configure environment

```bat
cd backend
copy .env.example .env
```

Open `backend/.env` and fill in:
```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/helpdesk_db
SECRET_KEY=any-long-random-string-here
GEMINI_API_KEY=your-gemini-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
APP_HOST=0.0.0.0
APP_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

---

### 4. Install dependencies

```bat
setup_windows.bat
```

---

### 5. Start backend

Open **Terminal 1**:
```bat
cd backend
venv\Scripts\activate
python main.py
```

Backend runs at `http://localhost:8000`

---

### 6. Start frontend

Open **Terminal 2**:
```bat
cd frontend
npm start
```

App opens at `http://localhost:3000` 🎉

---

## Common Errors

| Error | Fix |
|---|---|
| `database does not exist` | Run `CREATE DATABASE helpdesk_db;` in pgAdmin |
| `GEMINI_API_KEY not set` | Check `backend/.env`, restart backend |
| `CORS error` | Make sure backend is running on port 8000 |
| `npm install fails` | Run `npm cache clean --force` then `npm install` |
| `Port 8000 in use` | Run `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` |

---

## API Endpoints

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, get token |
| POST | `/api/chat/send` | Send message, get AI reply |
| GET | `/api/chat/sessions` | List your chats |
| DELETE | `/api/chat/sessions/{id}` | Delete a chat |
| POST | `/api/admin/upload-sops` | Upload docs to RAG (admin only) |

Full interactive docs: `http://localhost:8000/api/docs`
---

## 📄 License

MIT — free to use, modify, and distribute.
