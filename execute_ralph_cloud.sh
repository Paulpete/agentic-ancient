#!/bin/bash
set -e

echo "🧬 RALPH LOOP - CLAWAI CLOUD EXECUTION"
echo "======================================"
echo ""
echo "Using GitHub Actions as free Ollama cloud service"
echo "This triggers the ClawAIBot workflow with Ralph strategies"
echo ""

GITHUB_TOKEN="<GITHUB_TOKEN>"
REPO="WhiteAiBlock/agentic-ancient"

# Trigger ClawAIBot workflow
echo "🚀 Triggering ClawAIBot workflow..."
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$REPO/actions/workflows/clawaibot.yml/dispatches \
  -d '{"ref":"main"}' \
  2>&1 | grep -v "token"

if [ $? -eq 0 ]; then
    echo "✅ Ralph loop triggered successfully"
    echo ""
    echo "📊 Monitor at: https://github.com/$REPO/actions"
    echo "💬 Telegram notifications: Chat ID 7792603242"
    echo ""
    echo "🦙 ClawAIBot will:"
    echo "  - Install Ollama on GitHub runners (free)"
    echo "  - Pull qwen2.5-coder:7b and deepseek-coder:6.7b"
    echo "  - Execute Ralph strategies with AI generation"
    echo "  - Run every 4 hours automatically"
    echo "  - Send results to Telegram"
else
    echo "❌ Failed to trigger workflow"
fi
