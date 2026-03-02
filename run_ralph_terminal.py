#!/usr/bin/env python3
"""
run_ralph_terminal.py
─────────────────────
Runs the CryptoGene-Omega agent loop directly in the terminal.
Integrates with:
  - Webhook reader (webhook_reader.py) via HTTP POST
  - Self-learning engine (self_learning_engine.py) for strategy evolution
  - Tax engine for real-time P/L capture
  - Telegram alerts

Usage:
  python3 run_ralph_terminal.py
  python3 run_ralph_terminal.py --interval 60 --strategies yield,signal,zk
"""

import asyncio
import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional
import aiohttp
from pathlib import Path

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="\033[90m%(asctime)s\033[0m \033[1m%(levelname)s\033[0m %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ralph")

# ── ANSI colours ──────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
CYAN   = "\033[96m"
YELLOW = "\033[93m"
RED    = "\033[91m"
DIM    = "\033[90m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

BANNER = f"""
{GREEN}{BOLD}
╔══════════════════════════════════════════════════════════╗
║          🧬  RALPH TERMINAL LOOP  —  ClawAi v0.2         ║
║       CryptoGene-Omega · Self-Learning · MEE Ready       ║
╚══════════════════════════════════════════════════════════╝
{RESET}"""

# ── Strategy registry ─────────────────────────────────────────────────────────
# Each strategy returns a result dict. Real execution hits the blockchain;
# this layer adds belief-gating, tax capture, and self-learning feedback.

class StrategyRunner:
    def __init__(self, name: str, belief_score: float = 0.7):
        self.name = name
        self.belief_score = belief_score
        self.executions = 0
        self.wins = 0
        self.total_pnl = 0.0

    async def execute(self, webhook_url: Optional[str] = None) -> Dict:
        """Execute strategy. Posts result to webhook if configured."""
        self.executions += 1

        # ── Simulate on-chain strategy logic ────────────────────────────────
        # In production: calls lib/ralph/strategies/<name>.ts via subprocess
        # or direct Python equivalent from crypto-agent-omega/agent/strategies/
        import random
        success = random.random() < self.belief_score
        pnl = round(random.uniform(-0.05, 0.15) if success else random.uniform(-0.1, 0.01), 4)

        result = {
            "strategy": self.name,
            "success": success,
            "profit_loss": pnl,
            "belief_score": self.belief_score,
            "execution_id": self.executions,
            "timestamp": int(time.time()),
            "asset": "SOL",
        }

        if success:
            self.wins += 1
        self.total_pnl += pnl

        # Post to webhook
        if webhook_url:
            try:
                async with aiohttp.ClientSession() as s:
                    await s.post(webhook_url, json={
                        "event": "strategy_executed",
                        "data": result,
                    }, timeout=aiohttp.ClientTimeout(total=3))
            except Exception:
                pass

        return result

    def update_belief(self, new_score: float):
        """Called by self-learning engine after each cycle."""
        old = self.belief_score
        self.belief_score = round(max(0.1, min(1.0, new_score)), 4)
        if abs(old - self.belief_score) > 0.01:
            log.info(f"{CYAN}[BELIEF] {self.name}: {old:.2f} → {self.belief_score:.2f}{RESET}")

    @property
    def win_rate(self) -> float:
        return (self.wins / self.executions) if self.executions > 0 else 0.0

    def __repr__(self):
        return (
            f"{self.name:<12} belief={self.belief_score:.2f} "
            f"execs={self.executions} wins={self.wins} pnl={self.total_pnl:+.4f}"
        )


# ── Self-learning import ──────────────────────────────────────────────────────
# Loads the SelfLearningEngine from self_learning_engine.py if available
def load_self_learning_engine():
    try:
        sys.path.insert(0, str(Path(__file__).parent))
        from self_learning_engine import SelfLearningEngine
        engine = SelfLearningEngine()
        log.info(f"{GREEN}[BRAIN] Self-learning engine loaded ✓{RESET}")
        return engine
    except ImportError:
        log.warning("[BRAIN] self_learning_engine.py not found — skipping evolution")
        return None


# ── Ralph Loop ────────────────────────────────────────────────────────────────

class RalphTerminalLoop:
    def __init__(
        self,
        interval: int = 60,
        strategies: List[str] = None,
        webhook_url: str = None,
        tax_url: str = None,
    ):
        self.interval = interval
        self.webhook_url = webhook_url
        self.tax_url = tax_url or "http://localhost:3000/api/tax"
        self.cycle = 0
        self.running = False
        self.session_pnl = 0.0

        strat_names = strategies or ["yield", "signal", "liquidity", "zk", "arbitrage"]
        self.strategies = {
            name: StrategyRunner(name, belief_score=0.65 + i * 0.05)
            for i, name in enumerate(strat_names)
        }

        self.brain = load_self_learning_engine()

    async def run_cycle(self):
        self.cycle += 1
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"\n{DIM}{'─' * 62}{RESET}")
        print(f"{BOLD}{GREEN}⚡ Cycle #{self.cycle}{RESET}  {DIM}{ts}{RESET}")

        results = []
        for name, strategy in self.strategies.items():
            # Belief gate — skip if too low confidence
            if strategy.belief_score < 0.3:
                log.info(f"{DIM}[SKIP] {name} — belief too low ({strategy.belief_score:.2f}){RESET}")
                continue

            result = await strategy.execute(self.webhook_url)
            results.append(result)
            self.session_pnl += result["profit_loss"]

            color = GREEN if result["success"] else RED
            sign  = "+" if result["profit_loss"] >= 0 else ""
            print(
                f"  {color}{'✓' if result['success'] else '✗'}{RESET} "
                f"{name:<12} {DIM}belief={strategy.belief_score:.2f}{RESET}  "
                f"pnl={color}{sign}{result['profit_loss']:.4f} SOL{RESET}"
            )

            # Post tax event
            await self._post_tax_event(result)

        # ── Self-learning: evolve belief scores ───────────────────────────
        if self.brain:
            new_beliefs = self.brain.evolve(results, self.strategies)
            for name, score in new_beliefs.items():
                if name in self.strategies:
                    self.strategies[name].update_belief(score)

        # ── Cycle summary ─────────────────────────────────────────────────
        successful = sum(1 for r in results if r["success"])
        cycle_pnl  = sum(r["profit_loss"] for r in results)
        session_color = GREEN if self.session_pnl >= 0 else RED
        print(f"\n  {DIM}Strategies:{RESET} {len(results)}  "
              f"{GREEN}✓ {successful}{RESET}  {RED}✗ {len(results)-successful}{RESET}  "
              f"{DIM}Cycle PnL:{RESET} {GREEN if cycle_pnl>=0 else RED}{cycle_pnl:+.4f} SOL{RESET}  "
              f"{DIM}Session:{RESET} {session_color}{self.session_pnl:+.4f} SOL{RESET}")

    async def _post_tax_event(self, result: Dict):
        """Post tax event to /api/tax for dashboard capture."""
        if not result.get("profit_loss") or result["profit_loss"] == 0:
            return
        pnl = result["profit_loss"]
        event_type = "lp_fee" if result["strategy"] in ("yield", "zk", "liquidity") else "swap"
        tax_cat = "ordinary_income" if event_type == "lp_fee" else (
            "short_term_gain" if pnl >= 0 else "short_term_loss"
        )
        payload = {
            "eventType": event_type,
            "asset": result.get("asset", "SOL"),
            "amount": abs(pnl),
            "gainLossUsd": round(pnl * 140, 2),   # ~$140/SOL placeholder
            "taxCategory": tax_cat,
            "strategySource": result["strategy"],
            "notes": f"Ralph terminal cycle #{self.cycle}",
        }
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(self.tax_url, json=payload,
                             timeout=aiohttp.ClientTimeout(total=2))
        except Exception:
            pass

    async def start(self):
        self.running = True
        print(BANNER)
        print(f"  {DIM}Interval : {self.interval}s{RESET}")
        print(f"  {DIM}Strategies: {', '.join(self.strategies.keys())}{RESET}")
        print(f"  {DIM}Webhook  : {self.webhook_url or 'disabled'}{RESET}")
        print(f"  {DIM}Tax API  : {self.tax_url}{RESET}")
        print(f"  {YELLOW}Press Ctrl+C to stop{RESET}\n")

        try:
            while self.running:
                await self.run_cycle()
                if self.running:
                    log.info(f"{DIM}Sleeping {self.interval}s…{RESET}")
                    await asyncio.sleep(self.interval)
        except asyncio.CancelledError:
            pass
        except KeyboardInterrupt:
            pass
        finally:
            self.running = False
            print(f"\n{YELLOW}[RALPH] Loop stopped. Session PnL: {self.session_pnl:+.4f} SOL{RESET}")
            print(f"\n{DIM}Strategy summary:{RESET}")
            for s in self.strategies.values():
                print(f"  {s}")


def main():
    parser = argparse.ArgumentParser(description="Ralph Terminal Loop")
    parser.add_argument("--interval", type=int, default=30, help="Seconds between cycles")
    parser.add_argument("--strategies", type=str, default="yield,signal,liquidity,zk,arbitrage",
                        help="Comma-separated strategy names")
    parser.add_argument("--webhook", type=str, default="http://localhost:8765/webhook",
                        help="Webhook URL to POST results to")
    parser.add_argument("--tax-url", type=str, default="http://localhost:3000/api/tax",
                        help="Tax API URL")
    args = parser.parse_args()

    loop_runner = RalphTerminalLoop(
        interval=args.interval,
        strategies=args.strategies.split(","),
        webhook_url=args.webhook,
        tax_url=args.tax_url,
    )

    asyncio.run(loop_runner.start())


if __name__ == "__main__":
    main()
