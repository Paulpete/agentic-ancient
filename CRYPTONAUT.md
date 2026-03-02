# 🤖 CRYPTONAUT AGENT

Your autonomous crypto developer, deployer, and operator — acting on your behalf 24/7.

## What CryptoNaut Does

| Role | Actions |
|------|---------|
| **Dev** | Generates Anchor programs, TypeScript clients, Biconomy relay code |
| **Deployer** | Plans + executes Solana program deployments via Anchor CLI |
| **Operator** | Runs Ralph Loop strategies via Ollama (free AI, no API cost) |
| **DeFi Analyst** | Scans portfolio, tracks airdrop eligibility, monitors protocols |
| **Auto-Committer** | Pushes generated code + cycle reports to this repo automatically |

---

## Architecture

```
GitHub Actions (cron: */30 * * * *)
       │
       ▼
CryptoNaut Agent (Python)
       │
       ├── OllamaBrain ──────── qwen2.5-coder:7b (FREE local AI)
       │                        deepseek-coder:6.7b (fallback)
       │
       ├── RalphOllamaLoop ──── 6 strategies per cycle:
       │                        yield_harvest / signal_seek / liquidity_sniff
       │                        zk_farm / airdrop_hunt / belief_rewrite
       │
       ├── SolanaOperator ───── Helius RPC → portfolio scan, TX history
       │
       ├── Deployer ─────────── Anchor deployment planning + code gen
       │
       └── BiconomyMCP ──────── docs.biconomy.io/mcp → live SDK docs
```

---

## GitHub Secrets Required

Go to: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Description | Required |
|--------|-------------|----------|
| `AGENT_WALLET_ADDRESS` | Your Solana wallet address (public key only) | ✅ |
| `HELIUS_API_KEY` | Helius API key for enhanced RPC | ✅ |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for notifications | ⭐ Recommended |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | ⭐ Recommended |
| `MORALIS_API_KEY` | Moralis API for cross-chain data | Optional |

> **Note:** CryptoNaut uses Ollama (free, runs in GitHub Actions) — no `ANTHROPIC_API_KEY` or paid AI service needed.

---

## Workflows

### `cryptonaut-ralph-ollama.yml` — Main loop (auto, every 30 min)
Runs Ralph Loop strategy cycles via Ollama AI. Scans portfolio, executes strategies, sends Telegram report, auto-commits.

### `cryptonaut-deployer.yml` — On-demand deployer (manual trigger)
Trigger from GitHub Actions → Run workflow. Tasks:
- `generate_biconomy_relay` → Generates gasless tx code for any contract
- `plan_anchor_deployment` → Plans Solana program deployment steps  
- `query_biconomy_mcp` → Live search of Biconomy docs
- `full_status` → Complete agent status report

---

## Local Development

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull qwen2.5-coder:7b

# Set env vars
export AGENT_WALLET_ADDRESS=your_solana_wallet
export HELIUS_API_KEY=your_key

# Run a Ralph cycle
python3 crypto-agent-omega/agent/cryptonaut/cryptonaut_agent.py ralph --cycles 1

# Scan portfolio
python3 crypto-agent-omega/agent/cryptonaut/cryptonaut_agent.py scan

# Full status
python3 crypto-agent-omega/agent/cryptonaut/cryptonaut_agent.py status

# Generate Biconomy relay code
python3 crypto-agent-omega/agent/cryptonaut/cryptonaut_agent.py relay \
  --contract 0xYourContract \
  --function execute \
  --chain-id 8453

# Query Biconomy MCP docs
python3 crypto-agent-omega/agent/cryptonaut/cryptonaut_agent.py biconomy \
  "how to send gasless transaction on Base"
```

---

## Biconomy MCP Integration

CryptoNaut queries the Biconomy MCP server (`https://docs.biconomy.io/mcp`) for live SDK documentation. This means generated Biconomy code always uses the current SDK patterns — no stale hardcoded examples.

**API endpoint in your app:**
```
GET  /api/biconomy/mcp?q=your+query
POST /api/biconomy/mcp  { "query": "your query" }
```

---

## Ralph Loop Strategies

| Strategy | What it evaluates | Tax Category |
|----------|-------------------|--------------|
| `yield_harvest` | DeFi yield positions (Marinade, Kamino) | Ordinary Income |
| `signal_seek` | On-chain momentum signals | Short/Long-term gain |
| `liquidity_sniff` | LP opportunities (Orca, Raydium) | Ordinary Income |
| `zk_farm` | ZK-compressed airdrop farming | Ordinary Income |
| `airdrop_hunt` | Protocol interaction eligibility | Ordinary Income |
| `belief_rewrite` | CAC-I: updates confidence scores | Non-taxable |

All executed strategies are automatically logged to `/api/tax` for tax tracking.

---

*Helix eternal. Empire compounds. 🧬*
