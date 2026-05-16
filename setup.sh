#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}========================================================="
echo "  HelpDesk AI — Automated Setup (Linux / macOS)"
echo -e "=========================================================${NC}"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}[ERROR] python3 not found. Install Python 3.10+ from https://python.org${NC}"
  exit 1
fi
echo -e "${GREEN}[OK]${NC} Python3 found: $(python3 --version)"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo -e "${RED}[ERROR] node not found. Install Node.js 18+ from https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js found: $(node --version)"

# Check PostgreSQL
if ! command -v psql &>/dev/null; then
  echo -e "${YELLOW}[WARNING]${NC} psql not found in PATH. Ensure PostgreSQL is installed & running."
fi

echo ""
echo -e "${CYAN}[STEP 1] Setting up Backend...${NC}"
echo "-------------------------------------------------------"
cd backend

if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}[INFO]${NC} Created backend/.env from .env.example"
  echo ""
  echo -e "${YELLOW}[ACTION REQUIRED]${NC} Edit backend/.env and configure:"
  echo "  - DATABASE_URL   (your PostgreSQL URL)"
  echo "  - GEMINI_API_KEY (from https://makersuite.google.com/app/apikey)"
  echo "  - SECRET_KEY     (any long random string)"
  echo ""
  read -p "Press Enter after editing .env to continue..."
fi

echo -e "${CYAN}[STEP 2]${NC} Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo -e "${CYAN}[STEP 3]${NC} Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo -e "${GREEN}[OK]${NC} Backend dependencies installed"

cd ..

echo ""
echo -e "${CYAN}[STEP 4] Setting up Frontend...${NC}"
echo "-------------------------------------------------------"
cd frontend
echo -e "${CYAN}[STEP 5]${NC} Installing Node.js dependencies..."
npm install --silent
echo -e "${GREEN}[OK]${NC} Frontend dependencies installed"
cd ..

echo ""
echo -e "${GREEN}========================================================="
echo "  Setup Complete!"
echo -e "=========================================================${NC}"
echo ""
echo "To START the application, open two terminals:"
echo ""
echo -e "  ${CYAN}Terminal 1 (Backend):${NC}"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    python main.py"
echo ""
echo -e "  ${CYAN}Terminal 2 (Frontend):${NC}"
echo "    cd frontend"
echo "    npm start"
echo ""
echo -e "  Then open: ${GREEN}http://localhost:3000${NC}"
echo ""
