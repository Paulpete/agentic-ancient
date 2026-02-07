#!/bin/bash
set -e

echo "🦙 ACTIVATING CLAWAIBOT WITH OLLAMA FREE SERVICES"

# Install Ollama if not present
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Pull free models
echo "📥 Pulling free AI models..."
ollama pull qwen2.5-coder:7b
ollama pull deepseek-coder:6.7b

# Configure Claude Code to use Ollama
export ANTHROPIC_BASE_URL="http://localhost:11434/v1"
export ANTHROPIC_API_KEY="ollama"

echo "✅ Ollama models ready"
echo "✅ Claude Code configured for free inference"

# Test generation
echo ""
echo "🧪 Testing code generation..."
curl -s http://localhost:11434/api/generate -d '{
  "model": "qwen2.5-coder:7b",
  "prompt": "Write a Python function to calculate fibonacci",
  "stream": false
}' | python3 -c "import sys, json; print(json.load(sys.stdin)['response'][:200])"

echo ""
echo "🤖 CLAWAIBOT ACTIVATED - FREE AI CODING ENABLED"
