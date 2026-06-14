# Iris AI — Complete Windows Setup Guide
> VS Code · No virtual environment · No PgAdmin needed

---

## What you will have at the end

```
iris-final/
├── backend/
│   ├── main.py
│   ├── backend.py
│   ├── database.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── seed.sql             ← 10 test users
│   ├── manage_admin.py      ← add / remove admins from terminal
│   ├── show_users.py        ← live user log table in terminal
│   └── rag_data/
│       ├── chroma_db/
│       └── uploads/
│           └── return_policy.json
└── frontend/
    ├── AmazonReplica.js
    ├── HelpDeskWidget.js
    └── IrisWidget.js
```

---

## PART 1 — Install Prerequisites
> Do this once on your machine. Open **PowerShell as Administrator**.

### 1.1 Python 3.11
```powershell
winget install Python.Python.3.11
```
Close PowerShell and reopen it, then verify:
```powershell
python --version
pip --version
```

### 1.2 Node.js LTS
```powershell
winget install OpenJS.NodeJS.LTS
```
Verify:
```powershell
node --version
npm --version
```

### 1.3 PostgreSQL 16
```powershell
winget install PostgreSQL.PostgreSQL.16
```
> During the installer, set a password for the `postgres` user — **write it down**, you will need it.

After install, add PostgreSQL to your PATH permanently:
```powershell
[System.Environment]::SetEnvironmentVariable(
    "PATH",
    $env:PATH + ";C:\Program Files\PostgreSQL\16\bin",
    "Machine"
)
```
Close and reopen PowerShell, then verify:
```powershell
psql --version
```

### 1.4 Ollama
Download the Windows installer from https://ollama.com/download/windows and run it.

Verify:
```powershell
ollama --version
```

---

## PART 2 — One-Time Project Setup
> Open the `iris-final` folder in VS Code.
> Press **Ctrl + `** to open the integrated terminal.

### Step 1 — Create the database
You do NOT need PgAdmin. Run this one command in the VS Code terminal:
```powershell
psql -U postgres -c "CREATE DATABASE helpdesk_db;"
```
Enter your PostgreSQL password when prompted. You will see:
```
CREATE DATABASE
```
That is all — the database is ready.

### Step 2 — Pull an LLM model into Ollama
```powershell
ollama pull llama3.1
```
> Downloads ~4 GB once. Stays cached forever after that.

### Step 3 — Set up your .env file
```powershell
cd backend
copy .env.example .env
```
Open `.env` in VS Code and fill in your values:
```
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/helpdesk_db
SECRET_KEY=make-up-any-long-random-string-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
OLLAMA_BASE_URL=http://localhost:11434
CORS_ORIGINS=http://localhost:3000
APP_PORT=8000
```
Replace `YOUR_POSTGRES_PASSWORD` with the password you set during PostgreSQL install.

### Step 4 — Install Python packages
```powershell
cd backend
pip install -r requirements.txt
```

### Step 5 — Start the backend once (this creates all tables automatically)
```powershell
cd backend
uvicorn main:app --reload --port 8000
```
Wait until you see:
```
✅ Server ready at http://localhost:8000
```
Then press **Ctrl+C** to stop it — tables are now created.

### Step 6 — Seed the test database
```powershell
cd backend
psql -U postgres -d helpdesk_db -f seed.sql
```
You will see a verification table at the end like:
```
  table_name          | rows
  ──────────────────────────
  ✅ users            |   10
  ✅ customers        |   10
  ✅ addresses        |   10
  ✅ payment_profiles |   10
  ✅ orders           |   20
  ✅ browsing_history |   28
  ✅ admins           |    1
```

### Step 7 — Set up the frontend
```powershell
cd ..\frontend
npx create-react-app .
```
> If it asks to overwrite existing files — type `y`.

Copy the three JS files into `src/`:
```powershell
copy AmazonReplica.js  src\
copy HelpDeskWidget.js src\
copy IrisWidget.js     src\
```

Create the frontend `.env`:
```powershell
echo REACT_APP_API_URL=http://localhost:8000/api > .env
```

Open `src/index.js` and replace the entire file with:
```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AmazonReplica';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

Install frontend dependencies:
```powershell
npm install react-router-dom axios react-hot-toast
```

---

## PART 3 — Running the Project Every Day

Open **3 terminals** in VS Code (click the `+` icon in the terminal panel to add more).

| Terminal | What to run | What it does |
|----------|-------------|--------------|
| **1** | `ollama serve` | Starts the local LLM |
| **2** | `cd backend` then `uvicorn main:app --reload --port 8000` | Starts the API |
| **3** | `cd frontend` then `npm start` | Starts the React app |

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000
- Swagger docs → http://localhost:8000/api/docs

---

## PART 4 — Managing Admins from VS Code Terminal

All admin management is done with `manage_admin.py` inside the `backend/` folder.

### Interactive menu (easiest)
```powershell
cd backend
python manage_admin.py
```
You will see:
```
╔══════════════════════════════════════════╗
║       Iris AI — Admin Manager            ║
╚══════════════════════════════════════════╝

  What do you want to do?

  1  Add an admin
  2  Remove an admin
  3  List all admins
  4  Exit

  Enter choice (1/2/3/4):
```

### Add an admin directly
```powershell
python manage_admin.py add someone@gmail.com
```
Output:
```
  Adding admin: someone@gmail.com
  ────────────────────────────────────────────────────────────
  ✅ Inserted into admins table  (admin_id = 2)
  ✅ users.is_admin → TRUE   (their_username)
  ✅ customers.is_admin → TRUE  (their_username)

  Done! someone@gmail.com is now an admin.
```

### Remove an admin
```powershell
python manage_admin.py remove someone@gmail.com
```

### List all current admins
```powershell
python manage_admin.py list
```

> **Note:** If the person has not registered yet, the script still adds their email to the admins table.
> The moment they register, the trigger automatically gives them admin access.

---

## PART 5 — Viewing the User Log Table

### Show all users once
```powershell
cd backend
python show_users.py
```
Example output:
```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║   Iris AI — User Log                                              Refreshed: 2025-06-03      ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝

  #    Email                                  Username           Full Name              Role          Active  Registered At     Sessions  Messages
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  1    akshatkhandelwalunofficial@gmail.com   akshat_admin       Akshat Khandelwal      ★ Admin       ✓       2025-06-03 10:00         2        14
  2    ak.professional47@gmail.com            akshat_pro         Akshat Professional    Normal User   ✓       2025-06-03 10:00         1         3
  3    priya.sharma@gmail.com                 priya_sharma       Priya Sharma           Normal User   ✓       2025-06-03 10:00         0         0
  ...
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  Total: 10   ★ Admins: 1   Normal users: 9
```

### Auto-refresh every 5 seconds (watch mode)
```powershell
python show_users.py --watch
```
Press **Ctrl+C** to stop.

### Filter by role
```powershell
python show_users.py --admins    # show only admins
python show_users.py --normal    # show only normal users
```

---

## PART 6 — Test Accounts (from seed.sql)

| # | Email | Role | Password |
|---|-------|------|----------|
| 1 | akshatkhandelwalunofficial@gmail.com | **★ Admin** | Test@1234 |
| 2 | ak.professional47@gmail.com | Normal User | Test@1234 |
| 3 | priya.sharma@gmail.com | Normal User | Test@1234 |
| 4 | rahul.verma@gmail.com | Normal User | Test@1234 |
| 5 | neha.gupta@gmail.com | Normal User | Test@1234 |
| 6 | arjun.mehta@gmail.com | Normal User | Test@1234 |
| 7 | kavya.nair@gmail.com | Normal User | Test@1234 |
| 8 | rohit.singh@gmail.com | Normal User | Test@1234 |
| 9 | ananya.patel@gmail.com | Normal User | Test@1234 |
| 10 | vikram.rao@gmail.com | Normal User | Test@1234 |

---

## PART 7 — Troubleshooting

**`psql` not recognised**
```powershell
# Add PostgreSQL bin to PATH manually
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
```

**`pip` not recognised**
```powershell
python -m pip install -r requirements.txt
```

**PostgreSQL connection refused**
```powershell
# Start the service
net start postgresql-x64-16
```

**Port 8000 already in use**
```powershell
netstat -ano | findstr :8000
taskkill /PID <PID_FROM_ABOVE> /F
```

**Ollama model not found**
```powershell
ollama list           # see what is installed
ollama pull llama3.1  # re-pull
```

**`sentence-transformers` slow on first run**
Normal — it downloads the embedding model (~90 MB) once on first startup and caches it.

**Frontend shows blank page**
Make sure `src/index.js` imports from `./AmazonReplica` and you ran:
```powershell
npm install react-router-dom axios react-hot-toast
```

**seed.sql fails with "relation does not exist"**
The backend must be started once first so `init_db()` creates all the tables. Start it, wait for the ready message, then Ctrl+C and run the seed.
