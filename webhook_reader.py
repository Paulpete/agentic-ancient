#!/usr/bin/env python3
"""
webhook_reader.py
─────────────────
FastAPI webhook server. Receives events from:
  - Ralph terminal loop (strategy_executed, cycle_complete)
  - Biconomy MEE deployer (tx_submitted, tx_confirmed, tx_failed)
  - Moralis streams (on-chain triggers: token transfer, swap, mint)
  - GitHub Actions (cosmic mutation results)

Routes events to:
  - Self-learning engine (for strategy evolution)
  - Tax engine log
  - Telegram alerts
  - In-memory event store (readable at /events)

Usage:
  python3 webhook_reader.py
  python3 webhook_reader.py --port 8765 --telegram-token <tok> --chat-id <id>
"""

import asyncio
import json
import logging
import os
import time
import argparse
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import uvicorn
import aiohttp

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [WEBHOOK] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("webhook")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="ClawAi Webhook Reader", version="0.2.0")

# ── In-memory event store (last 1000 events) ──────────────────────────────────
event_store: deque = deque(maxlen=1000)

# ── Running stats ─────────────────────────────────────────────────────────────
stats = {
    "total_received": 0,
    "strategy_events": 0,
    "tx_events": 0,
    "moralis_events": 0,
    "github_events": 0,
    "errors": 0,
    "started_at": int(time.time()),
}

# ── Telegram config (optional) ────────────────────────────────────────────────
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT  = os.getenv("TELEGRAM_CHAT_ID", "")


async def telegram_alert(message: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(url, json={"chat_id": TELEGRAM_CHAT, "text": message, "parse_mode": "Markdown"})
    except Exception as e:
        log.warning(f"Telegram failed: {e}")


# ── Self-learning integration ─────────────────────────────────────────────────
_sl_engine = None

def get_self_learning():
    global _sl_engine
    if _sl_engine is None:
        try:
            import sys; sys.path.insert(0, ".")
            from self_learning_engine import SelfLearningEngine
            _sl_engine = SelfLearningEngine()
            log.info("Self-learning engine loaded ✓")
        except ImportError:
            pass
    return _sl_engine


# ── Event router ──────────────────────────────────────────────────────────────

async def route_event(event_type: str, data: Dict, background: BackgroundTasks):
    """Routes each event to the appropriate downstream handler."""

    record = {
        "id": f"evt_{int(time.time() * 1000)}",
        "received_at": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "data": data,
    }
    event_store.appendleft(record)
    stats["total_received"] += 1

    # ── Strategy execution results (from Ralph terminal loop) ──────────────
    if event_type == "strategy_executed":
        stats["strategy_events"] += 1
        result = data
        strategy = result.get("strategy", "unknown")
        pnl = result.get("profit_loss", 0)
        success = result.get("success", False)
        log.info(f"📊 Strategy [{strategy}] {'✓' if success else '✗'}  pnl={pnl:+.4f}")

        # Feed into self-learning
        sl = get_self_learning()
        if sl:
            background.add_task(sl.record_result, result)

        # Telegram alert on significant moves
        if abs(pnl) > 0.05:
            await telegram_alert(
                f"🧬 *Ralph Alert*\n"
                f"Strategy: `{strategy}`\n"
                f"PnL: `{pnl:+.4f} SOL`\n"
                f"Success: {'✅' if success else '❌'}"
            )

    # ── Biconomy MEE deployer results ──────────────────────────────────────
    elif event_type in ("tx_submitted", "tx_confirmed", "tx_failed"):
        stats["tx_events"] += 1
        tx_hash = data.get("hash", "—")
        chain = data.get("chain", "unknown")
        label = data.get("label", "")
        emoji = {"tx_submitted": "📡", "tx_confirmed": "✅", "tx_failed": "❌"}[event_type]
        log.info(f"{emoji} TX [{chain}] {tx_hash[:20]}… {label}")

        if event_type == "tx_failed":
            await telegram_alert(
                f"❌ *TX Failed*\n"
                f"Chain: `{chain}`\n"
                f"Hash: `{tx_hash[:20]}…`\n"
                f"Error: `{data.get('error', 'unknown')}`"
            )
        elif event_type == "tx_confirmed":
            await telegram_alert(
                f"✅ *TX Confirmed*\n"
                f"Chain: `{chain}` · {label}\n"
                f"`{tx_hash[:20]}…`"
            )

    # ── Moralis on-chain stream ────────────────────────────────────────────
    elif event_type in ("token_transfer", "swap_detected", "nft_mint"):
        stats["moralis_events"] += 1
        log.info(f"🔗 Moralis [{event_type}]  {data.get('txHash', '')[:16]}…")
        # Forward to tax capture
        background.add_task(forward_to_tax, event_type, data)

    # ── GitHub Actions (cosmic mutation) ──────────────────────────────────
    elif event_type == "github_action":
        stats["github_events"] += 1
        workflow = data.get("workflow", "")
        status   = data.get("status", "")
        log.info(f"🤖 GitHub [{workflow}] → {status}")
        if status == "completed":
            await telegram_alert(f"🤖 *GitHub Action*\n`{workflow}` → {status}")

    else:
        log.info(f"📬 Unknown event [{event_type}] — stored")


async def forward_to_tax(event_type: str, data: Dict):
    """Forwards on-chain events to the Next.js /api/tax endpoint."""
    mapping = {
        "token_transfer": ("transfer_out", "short_term_gain"),
        "swap_detected":  ("swap",          "short_term_gain"),
        "nft_mint":       ("nft_sale",      "short_term_gain"),
    }
    et, cat = mapping.get(event_type, ("swap", "short_term_gain"))
    pnl = float(data.get("valueUsd", 0))
    payload = {
        "eventType": et,
        "asset": data.get("tokenSymbol", "SOL"),
        "amount": float(data.get("amount", 0)),
        "gainLossUsd": pnl,
        "taxCategory": "non_taxable" if pnl == 0 else cat,
        "signature": data.get("txHash", ""),
        "notes": f"Moralis {event_type}",
    }
    try:
        async with aiohttp.ClientSession() as s:
            await s.post("http://localhost:3000/api/tax", json=payload,
                         timeout=aiohttp.ClientTimeout(total=2))
    except Exception:
        pass


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.post("/webhook")
async def receive_webhook(request: Request, background: BackgroundTasks):
    """Main webhook entry point — all senders POST here."""
    try:
        body = await request.json()
    except Exception:
        stats["errors"] += 1
        raise HTTPException(400, "Invalid JSON")

    event_type = body.get("event") or body.get("type") or "unknown"
    data = body.get("data") or body

    await route_event(event_type, data, background)
    return JSONResponse({"status": "received", "event": event_type, "id": event_store[0]["id"]})


@app.post("/webhook/moralis")
async def receive_moralis(request: Request, background: BackgroundTasks):
    """Dedicated Moralis stream endpoint."""
    body = await request.json()
    # Moralis sends txs array
    txs = body.get("txs", [body])
    for tx in txs:
        event_type = "swap_detected" if tx.get("type") == "swap" else "token_transfer"
        await route_event(event_type, tx, background)
    return JSONResponse({"status": "received", "count": len(txs)})


@app.post("/webhook/github")
async def receive_github(request: Request, background: BackgroundTasks):
    """GitHub Actions webhook."""
    body = await request.json()
    action = body.get("action", "")
    workflow = body.get("workflow", {}).get("name", "unknown")
    status   = body.get("workflow_run", {}).get("conclusion", action)
    await route_event("github_action", {"workflow": workflow, "status": status, "raw": body}, background)
    return JSONResponse({"status": "received"})


@app.get("/events")
async def get_events(limit: int = 50, event_type: str = None):
    """Read recent events from the store."""
    events = list(event_store)
    if event_type:
        events = [e for e in events if e["event_type"] == event_type]
    return JSONResponse({"events": events[:limit], "total": len(event_store), "stats": stats})


@app.get("/health")
async def health():
    uptime = int(time.time()) - stats["started_at"]
    return JSONResponse({"status": "ok", "uptime_seconds": uptime, "stats": stats})


@app.get("/")
async def root():
    return JSONResponse({
        "service": "ClawAi Webhook Reader",
        "version": "0.2.0",
        "endpoints": ["/webhook", "/webhook/moralis", "/webhook/github", "/events", "/health"],
        "stats": stats,
    })


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    args = parser.parse_args()
    log.info(f"🎣 Webhook reader starting on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
