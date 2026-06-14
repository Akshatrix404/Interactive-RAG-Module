# Iris AI

Iris AI is a full-stack AI-powered ecommerce assistant. The frontend simulates an Amazon-style storefront with an embedded chat widget ("Iris") that handles product orders, comparisons, offers, returns, and a separate help-desk widget for general support. The FastAPI backend powers a local LLM (via Ollama) with RAG-based policy/SOP retrieval (ChromaDB), JWT authentication, PostgreSQL-backed order/return management, AI-driven return validation, and image-based damage verification for return claims.

## Tech Stack

| Layer            | Technology |
|------------------|------------|
| Frontend         | React, JavaScript, React Router, Axios, React Hot Toast |
| Backend          | Python, FastAPI, Uvicorn |
| Database         | PostgreSQL, SQLAlchemy (async), asyncpg |
| Authentication   | JWT (python-jose), Passlib (bcrypt) |
| AI / LLM         | Ollama (llama3.1), iris-damage (vision model) |
| RAG / Vector DB  | ChromaDB, Sentence-Transformers (all-MiniLM-L6-v2) |
| Document Parsing | PyPDF2, python-docx, openpyxl, pandas, Pillow, BeautifulSoup4 |
| Config / Utils   | python-dotenv, Pydantic |

## Application Flow

**Chat Message** -> Fetch Customer Context (DB) -> Detect Intent (order / compare / offer / general) -> Retrieve RAG Context (ChromaDB) -> Generate Response (Ollama) -> Parse JSON/Text -> Return to Frontend

**Authentication** -> Receive Register/Login Request -> Validate Input -> Hash/Verify Password (bcrypt) -> Check Admin Table -> Generate JWT -> Return Token + User

**Order Placement** -> Detect "Order" Intent -> Extract Product Details (Ollama JSON) -> Confirm Order Request -> Insert Order Record -> Insert Browsing History -> Return Confirmation

**Return Initiation** -> Start Return Request -> Verify Order Delivered -> Check Return Window (Policy JSON) -> Create Return Session -> Request Return Reason

**Return Validation** -> Submit Reason -> Update Session -> Load Policy + Order Context -> AI Validation (UnifiedAIService via Ollama) -> Approve/Reject -> Insert Return Request -> (Optional) Fetch Recommendations

**Damage Verification** -> Upload Damage Images -> Run Vision Model (iris-damage via Ollama) -> Parse Verdict + Confidence -> Match (>=0.5) -> Recommendations / Mismatch -> Manual Review

**Wrong Item Check** -> Fetch Browsing History (30 days) -> Check Wanted Product in History -> History Match -> Amazon-style Recommendations / No Match -> Comparison Specs + Recommendations

**Changed Mind Flow** -> Select "Changed Mind" -> Fetch History-based Recommendations -> Provide Wanted Product -> Fetch Comparison Specs, Price & Rating -> Return Comparison Result

**SOP Ingestion (Admin)** -> Upload File -> Extract Text (by file type) -> Chunk Text -> Generate Embeddings (Sentence-Transformers) -> Store in ChromaDB -> Available for RAG Retrieval

## Installation

### Prerequisites
- Python 3.11+
- Node.js (LTS)
- PostgreSQL 16
- Ollama

### 1. Create the Database
```bash
psql -U postgres -c "CREATE DATABASE helpdesk_db;"
```

### 2. Pull the LLM Model
```bash
ollama pull llama3.1
```

### 3. Backend Setup
```bash
cd backend
cp .env.example .env        # fill in DB password, SECRET_KEY, etc.
pip install -r requirements.txt
uvicorn main:app --reload --port 8000   # creates tables on first run
```

### 4. Seed Test Data (optional)
```bash
psql -U postgres -d helpdesk_db -f seed.sql
```

### 5. Frontend Setup
```bash
cd frontend
npm install
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env
npm start
```

### 6. Run the App
| Terminal | Command |
|----------|---------|
| 1 | `ollama serve` |
| 2 | `uvicorn main:app --reload --port 8000` (from `backend/`) |
| 3 | `npm start` (from `frontend/`) |

- Frontend -> http://localhost:3000
- Backend API -> http://localhost:8000
- Swagger Docs -> http://localhost:8000/api/docs