#!/bin/bash
set -e

echo "🚀 LAUNCHING CLAWAI SOLANA AGENT WITH OLLAMA"
echo "=============================================="

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "⚠️  Ollama not installed. Using mock mode..."
    echo ""
    echo "To install Ollama (requires sudo):"
    echo "  curl -fsSL https://ollama.com/install.sh | sh"
    echo ""
    echo "For now, running in Helius-only mode (no AI generation)..."
    
    # Run without Ollama
    python3 clawai_solana_agent.py
    exit 0
fi

# Start Ollama server
echo "🦙 Starting Ollama server..."
nohup ollama serve > ollama.log 2>&1 &
OLLAMA_PID=$!
echo $OLLAMA_PID > ollama.pid
sleep 5

# Pull model if not exists
echo "📥 Ensuring qwen2.5-coder:7b model is available..."
ollama pull qwen2.5-coder:7b 2>&1 | tail -5

# Start ClawAI agent
echo ""
echo "🤖 Starting ClawAI Solana Agent (3-hour run)..."
echo "📊 Monitor: tail -f clawai_solana.log"
echo "🛑 Stop: kill \$(cat clawai.pid)"
echo ""

nohup python3 clawai_solana_agent.py > clawai_solana.log 2>&1 &
CLAWAI_PID=$!
echo $CLAWAI_PID > clawai.pid

sleep 3
echo "✅ ClawAI Agent running (PID: $CLAWAI_PID)"
echo ""
tail -20 clawai_solana.log
