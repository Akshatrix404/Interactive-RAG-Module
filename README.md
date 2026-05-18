# HelpDesk AI

AI-powered helpdesk with chat history, RAG, and admin SOP uploads.

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