#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}========================================================="
echo "  Ollama Setup for HelpDesk AI"
echo -e "=========================================================${NC}"

# Check if Ollama installed
if ! command -v ollama &>/dev/null; then
    echo -e "${YELLOW}[INFO]${NC} Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

echo -e "${GREEN}[OK]${NC} Ollama installed: $(ollama --version)"

# Start Ollama in background if not running
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "[INFO] Starting Ollama service..."
    ollama serve &>/dev/null &
    sleep 3
fi

echo ""
echo "[STEP] Pulling llama3.1 model (4.7 GB)..."
echo "       This will take several minutes on first run."
echo ""
ollama pull llama3.1 || {
    echo "llama3.1 failed, trying llama3.2:3b (smaller, faster)..."
    ollama pull llama3.2:3b
}

echo ""
echo -e "${GREEN}Installed models:${NC}"
ollama list

echo ""
echo -e "${GREEN}========================================================="
echo "  Ollama Setup Complete!"
echo -e "=========================================================${NC}"
echo ""
echo "Ollama is running at http://localhost:11434"
echo "The backend will auto-detect it on startup."
echo ""
echo "Other models you can try:"
echo "  ollama pull llama3.2:3b   (2 GB, faster)"
echo "  ollama pull phi3:mini     (2.3 GB)"
echo "  ollama pull mistral       (4.1 GB)"
