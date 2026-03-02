---
name: clawpump
description: "Launch tokens on Solana via ClawPump — gasless pump.fun launches, earn 65% of trading fees. Use when: user wants to launch a token, create a memecoin, check ClawPump earnings, search domains, or get swap quotes. Don't use when: user wants crypto prices (use crypto-prices skill), wants to swap tokens (use solana_swap tool), or wants wallet balance (use solana_balance tool)."
version: "1.1.0"
emoji: "\U0001F43E"
image: "https://seekerclaw.xyz/assets/partner-skills/clawpump.jpg"
requires:
  bins: []
  env: []
allowed-tools:
  - web_fetch
  - solana_address
  - solana_balance
  - solana_send
---

# ClawPump Token Launchpad

> **Third-party service.** ClawPump (clawpump.tech) is an independent platform not affiliated with SeekerClaw. Token launches involve real funds on Solana mainnet. SOL sent for self-funded launches is non-reversible. Earnings depend on trading volume and are not guaranteed. Platform terms may change without notice. Use at your own risk.

Launch tokens on pump.fun via ClawPump. Gasless (free) or self-funded (~0.03 SOL). Earn 65% of every trading fee automatically.

**Base URL:** `https://clawpump.tech`

## Use when

- "Launch a token", "create a memecoin", "launch on pump.fun"
- "Check my ClawPump earnings", "how much have I earned?"
- "What tokens have I launched?", "my launch history"
- "Find a domain for my agent", "is myagent.ai available?"
- "Get a swap quote on ClawPump"

## Don't use when

- Crypto prices without launching → use crypto-prices skill
- Execute a token swap → use solana_swap tool directly
- Check wallet balance → use solana_balance tool

---

## Flow 1: Gasless Token Launch (FREE)

The user pays nothing. ClawPump covers all Solana fees.

### Prerequisites

User must provide: **name**, **symbol**, **description**. Ask for any missing fields.
User must provide an **image URL** (PNG, JPEG, GIF, or WebP, max 5 MB). Options:
- User provides a direct URL to an image already hosted online
- Use `web_search` to find a relevant image the user likes, then use that URL
- If the user has no image, ask them to upload one to any image host (e.g., imgur.com) and share the link

### Steps

**Step 1 — Get the user's wallet address:**

```
solana_address({})
```

Save the returned `address` as `walletAddress`.

**Step 2 — Confirm with the user before launching:**

Show them:
- Token name, symbol, description
- Image URL
- Their wallet address (where earnings go)
- Cost: **FREE** (gasless)
- "ClawPump will launch this on pump.fun. You'll earn 65% of all trading fees. Proceed?"

Wait for explicit user approval. Never proceed without it.

**Step 3 — Launch the token:**

```
web_fetch({
  url: "https://clawpump.tech/api/launch",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: {
    "name": "<token name, 1-32 chars>",
    "symbol": "<SYMBOL, 1-10 chars, auto-uppercased>",
    "description": "<description, 20-500 chars>",
    "imageUrl": "<direct URL to image>",
    "agentId": "<walletAddress>",
    "agentName": "SeekerClaw",
    "walletAddress": "<walletAddress>",
    "website": "<optional>",
    "twitter": "<optional, handle without @>",
    "telegram": "<optional, group handle>"
  }
})
```

**Success response:**
```json
{
  "success": true,
  "mintAddress": "BPFLoader...",
  "txHash": "5VERv8NMvzbJMEkV...",
  "pumpUrl": "https://pump.fun/coin/BPFLoader...",
  "explorerUrl": "https://solscan.io/tx/5VERv8NMvzbJMEkV..."
}
```

**Step 4 — Present results:**

Show: token name, symbol, mint address, pump.fun link, explorer link, and "You're now earning 65% of all trading fees!"

### Error handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Validation error | Show `details` field, ask user to fix (e.g., description too short) |
| 429 | Rate limited (1 per 24h) | Tell user: "You can launch again in X hours." Show `retryAfterHours` |
| 500 | Server error | Tell user launch failed, suggest trying later |
| 503 | Gasless unavailable | Treasury low — switch to Flow 2 (self-funded). The response includes `suggestions.paymentFallback.selfFunded` with endpoint, cost, and platform wallet |

---

## Flow 2: Self-Funded Token Launch (~0.03 SOL)

Used when gasless returns 503 or user explicitly wants self-funded. Supports optional dev-buy.

### Steps

**Step 1 — Get payment info:**

```
web_fetch({
  url: "https://clawpump.tech/api/launch/self-funded",
  method: "GET"
})
```

Response includes `platformWallet` and `cost` (currently 0.03 SOL).

**Step 2 — Get user's wallet and balance:**

```
solana_address({})
solana_balance({})
```

Check balance is sufficient before proceeding.

**Step 3 — Confirm with the user:**

Show:
- Token details (name, symbol, description, image)
- Cost breakdown: 0.02 SOL (creation fee) + devBuySol (default 0.01, range 0-85)
- Their current SOL balance
- Platform wallet they'll pay to
- "This requires a SOL transfer. Your wallet app will ask you to approve."

If user wants a dev-buy, explain: tokens are split 50/50 between user and platform.

**Step 4 — Send payment:**

```
solana_send({
  to: "<platformWallet from step 1>",
  amount: <total cost>
})
```

Save the transaction signature from the result.

**Step 5 — Launch with payment proof:**

```
web_fetch({
  url: "https://clawpump.tech/api/launch/self-funded",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: {
    "name": "<token name>",
    "symbol": "<SYMBOL>",
    "description": "<description>",
    "imageUrl": "<image url>",
    "agentId": "<walletAddress>",
    "agentName": "SeekerClaw",
    "walletAddress": "<walletAddress>",
    "txSignature": "<tx signature from step 4>",
    "devBuySol": <optional, default 0.01, set 0 to disable>
  }
})
```

**Payment rules:**
- Payment sender must match `walletAddress`
- Signatures are single-use (replay-protected)
- SOL transfer must be within last 10 minutes

**Step 6 — Present results** (same as Flow 1 Step 4, plus dev-buy details if applicable).

### Additional errors

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Wrong amount, wrong recipient, or expired tx | Show error, ask to retry |
| 409 | Payment signature already used | Replay blocked — need new payment |

---

## Flow 3: Check Earnings

Read-only. Shows accumulated trading fee earnings.

```
solana_address({})
```

```
web_fetch({
  url: "https://clawpump.tech/api/fees/earnings?agentId=<walletAddress>",
  method: "GET"
})
```

**Response:**
```json
{
  "agentId": "...",
  "totalEarned": 1.52,
  "totalSent": 1.20,
  "totalPending": 0.32,
  "tokenBreakdown": [{ "mintAddress": "...", "totalCollected": 1.90, "totalAgentShare": 1.52 }]
}
```

Present: total earned (SOL), total sent to wallet, total pending, per-token breakdown.

---

## Flow 4: Launch History

Check tokens the user has previously launched.

```
solana_address({})
```

```
web_fetch({
  url: "https://clawpump.tech/api/launches?agentId=<walletAddress>&limit=20",
  method: "GET"
})
```

Present: token name, symbol, mint address, pump.fun link, launch date. If no results, the user hasn't launched any tokens yet.

---

## Flow 5: Domain Search

Read-only. Search and check domain availability.

**Search by keyword:**
```
web_fetch({
  url: "https://clawpump.tech/api/domains/search?q=<keyword>&tlds=com,io,ai,dev,xyz",
  method: "GET"
})
```

**Check specific domains:**
```
web_fetch({
  url: "https://clawpump.tech/api/domains/check?domains=<domain1>,<domain2>",
  method: "GET"
})
```

Present as table: domain name, available (yes/no), price (Conway price + 10% ClawPump fee = total).

Domain registration is coming in a future ClawPump update. For now, search and check only.

Rate limit: 30 requests per minute.

---

## Flow 6: Swap Quotes (Read-Only)

Get price quotes for token swaps via Jupiter. Returns a quote only — does not execute.

```
web_fetch({
  url: "https://clawpump.tech/api/swap?inputMint=<inputMint>&outputMint=<outputMint>&amount=<amount>&slippageBps=<optional, default 100>",
  method: "GET"
})
```

**Common mint addresses:**
- SOL: `So11111111111111111111111111111111111111112`
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

Amount is in smallest units (1 SOL = 1,000,000,000 lamports, 1 USDC = 1,000,000).

Present: input/output amounts, price impact %, route (which DEXs).

To execute a swap, tell the user to use the `solana_swap` tool directly.

---

## Safety Rules

1. **Always confirm before launching.** Never call `/api/launch` or `/api/launch/self-funded` without explicit user approval.
2. **Require name, symbol, description, and image URL.** Ask for any missing fields. Do not invent token details.
3. **Check balance before self-funded payment.** Show SOL amount and current balance before calling `solana_send`.
4. **Never send private keys.** Only public wallet address and transaction signatures go to ClawPump APIs.
5. **Gasless first.** Always try the free gasless launch. Only suggest self-funded if gasless returns 503 or user explicitly asks.
6. **One launch per 24 hours.** If rate-limited (429), tell the user when they can launch again.
