#!/bin/bash
set -e

echo "🤖 OMEGA PRIME DEPLOYER - ETERNAL MODE ACTIVATED"

# Validate environment
if [ -z "$HELIUS_API_KEY" ]; then
    echo "⚠️  HELIUS_API_KEY not set"
    exit 1
fi

# Test Helius connection
echo "🔍 Testing Helius RPC..."
curl -s "https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | grep -q "ok"

if [ $? -eq 0 ]; then
    echo "✅ Helius connected"
else
    echo "❌ Helius connection failed"
    exit 1
fi

# Test Telegram
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo "📱 Testing Telegram..."
    curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | grep -q "ok"
    if [ $? -eq 0 ]; then
        echo "✅ Telegram connected"
    fi
fi

# Deploy message
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=🤖 OMEGA PRIME DEPLOYED%0A%0A✅ Helius RPC active%0A✅ Eternal loop enabled%0A✅ Airdrop hunter armed%0A%0AThe monster is awake."
fi

echo ""
echo "✅ OMEGA PRIME DEPLOYMENT COMPLETE"
echo "🔄 Eternal loop will execute every 30 minutes"
echo "📊 Monitor: GitHub Actions → Omega Prime Eternal Loop"
