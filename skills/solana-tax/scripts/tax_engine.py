#!/usr/bin/env python3
"""
Solana Tax Engine — ClawAi Autonomous Tax Solver
Uses @solana/kit (Web3.js v2) patterns for on-chain data fetching.
Computes capital gains, income events, and full IRS-ready reports.
"""
import json
import os
import csv
import subprocess
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from collections import defaultdict


# ─── Enums & Data Classes ────────────────────────────────────────────────────

class TaxMethod(Enum):
    FIFO = "fifo"   # First-In First-Out (IRS recommended default)
    LIFO = "lifo"   # Last-In First-Out
    HIFO = "hifo"   # Highest-In First-Out (minimizes total gain)


class EventType(Enum):
    SWAP          = "swap"           # Token-to-token swap (DEX)
    TRANSFER_OUT  = "transfer_out"   # SOL/token sent out
    TRANSFER_IN   = "transfer_in"    # SOL/token received (non-income)
    STAKE_REWARD  = "stake_reward"   # Staking yield (ordinary income)
    LP_FEE        = "lp_fee"         # Liquidity pool fees (ordinary income)
    AIRDROP       = "airdrop"        # Token airdrop (ordinary income)
    NFT_SALE      = "nft_sale"       # NFT sold (capital gain/loss)
    NFT_MINT      = "nft_mint"       # NFT purchased (cost basis event)
    WALLET_XFER   = "wallet_xfer"    # Same-owner wallet transfer (non-taxable)
    UNKNOWN       = "unknown"


class TaxCategory(Enum):
    SHORT_TERM_GAIN  = "short_term_gain"   # Held < 1 year
    LONG_TERM_GAIN   = "long_term_gain"    # Held >= 1 year
    SHORT_TERM_LOSS  = "short_term_loss"
    LONG_TERM_LOSS   = "long_term_loss"
    ORDINARY_INCOME  = "ordinary_income"
    NON_TAXABLE      = "non_taxable"


@dataclass
class RawTransaction:
    """Raw Solana transaction data from @solana/kit."""
    signature: str
    slot: int
    block_time: int          # Unix timestamp
    fee: int                 # Lamports
    pre_balances: List[int]
    post_balances: List[int]
    pre_token_balances: List[Dict]
    post_token_balances: List[Dict]
    accounts: List[str]
    log_messages: List[str]
    meta_err: Optional[Any] = None


@dataclass
class TaxEvent:
    """A classified, priced tax event."""
    signature: str
    timestamp: int
    date: str
    event_type: EventType
    asset: str               # Token symbol or mint address
    amount: float            # Amount disposed/received
    cost_basis_usd: float    # Original cost (acquisition price)
    proceeds_usd: float      # Fair market value at disposal
    gain_loss_usd: float     # proceeds - cost_basis
    holding_days: int
    tax_category: TaxCategory
    method: str              # fifo/lifo/hifo
    notes: str = ""


@dataclass
class CostBasisLot:
    """An acquisition lot for cost basis tracking."""
    asset: str
    amount: float
    cost_per_unit_usd: float
    acquired_at: int         # Unix timestamp
    signature: str


@dataclass
class TaxReport:
    """Complete annual tax report."""
    wallet: str
    year: int
    method: str
    generated_at: str
    total_gains: float
    total_losses: float
    net_capital_gain: float
    short_term_gains: float
    long_term_gains: float
    total_income: float
    estimated_tax: float     # Rough estimate only
    events: List[TaxEvent] = field(default_factory=list)
    income_events: List[TaxEvent] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)


# ─── Price Oracle ─────────────────────────────────────────────────────────────

class PriceOracle:
    """Historical token price lookup via CoinGecko / Birdeye."""

    COINGECKO_IDS = {
        "SOL":  "solana",
        "USDC": "usd-coin",
        "USDT": "tether",
        "BTC":  "bitcoin",
        "ETH":  "ethereum",
        "JUP":  "jupiter-exchange-solana",
        "BONK": "bonk",
        "WIF":  "dogwifcoin",
        "RAY":  "raydium",
        "ORCA": "orca",
        "MNGO": "mango-markets",
    }

    def __init__(self, provider: str = "coingecko"):
        self.provider = provider
        self._cache: Dict[str, float] = {}

    def get_price_at(self, asset: str, timestamp: int) -> float:
        """Return USD price of asset at given Unix timestamp."""
        cache_key = f"{asset}:{timestamp // 3600}"  # 1-hour granularity
        if cache_key in self._cache:
            return self._cache[cache_key]

        date_str = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%d-%m-%Y")

        # Stablecoins are always $1
        if asset.upper() in ("USDC", "USDT", "DAI", "BUSD", "USDH", "USDR"):
            return 1.0

        price = self._fetch_coingecko(asset, date_str)
        self._cache[cache_key] = price
        return price

    def _fetch_coingecko(self, asset: str, date_str: str) -> float:
        """Fetch historical price from CoinGecko free API."""
        coin_id = self.COINGECKO_IDS.get(asset.upper())
        if not coin_id:
            print(f"  ⚠ Unknown asset: {asset}, defaulting price to $0")
            return 0.0

        url = (
            f"https://api.coingecko.com/api/v3/coins/{coin_id}/history"
            f"?date={date_str}&localization=false"
        )

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ClawAi-TaxEngine/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                price = data["market_data"]["current_price"]["usd"]
                return float(price)
        except Exception as e:
            print(f"  ⚠ Price fetch failed for {asset} on {date_str}: {e}")
            return 0.0


# ─── Transaction Fetcher (calls kit_fetcher.js) ────────────────────────────────

class KitFetcher:
    """
    Calls scripts/kit_fetcher.js (Node.js) which uses @solana/kit
    to fetch raw transaction history. Falls back to direct RPC calls
    via urllib if Node.js is unavailable.
    """

    def __init__(self, rpc_url: str):
        self.rpc_url = rpc_url
        self.script_dir = Path(__file__).parent
        self._node_available = self._check_node()

    def _check_node(self) -> bool:
        try:
            result = subprocess.run(["node", "--version"], capture_output=True, timeout=5)
            return result.returncode == 0
        except Exception:
            return False

    def get_signatures(self, wallet: str, limit: int = 1000) -> List[Dict]:
        """Fetch all transaction signatures for a wallet."""
        if self._node_available:
            return self._node_get_signatures(wallet, limit)
        return self._rpc_get_signatures(wallet, limit)

    def get_transaction(self, signature: str) -> Optional[Dict]:
        """Fetch full transaction details by signature."""
        if self._node_available:
            return self._node_get_transaction(signature)
        return self._rpc_get_transaction(signature)

    def _node_get_signatures(self, wallet: str, limit: int) -> List[Dict]:
        """Use kit_fetcher.js (Node) for @solana/kit-native fetch."""
        script = self.script_dir / "kit_fetcher.js"
        if not script.exists():
            print("  ⚠ kit_fetcher.js not found, using fallback RPC")
            return self._rpc_get_signatures(wallet, limit)

        try:
            result = subprocess.run(
                ["node", str(script), "signatures", wallet, str(limit), self.rpc_url],
                capture_output=True, text=True, timeout=60
            )
            return json.loads(result.stdout)
        except Exception as e:
            print(f"  ⚠ Node fetch failed: {e}, using fallback")
            return self._rpc_get_signatures(wallet, limit)

    def _node_get_transaction(self, signature: str) -> Optional[Dict]:
        script = self.script_dir / "kit_fetcher.js"
        if not script.exists():
            return self._rpc_get_transaction(signature)

        try:
            result = subprocess.run(
                ["node", str(script), "transaction", signature, self.rpc_url],
                capture_output=True, text=True, timeout=30
            )
            return json.loads(result.stdout)
        except Exception:
            return self._rpc_get_transaction(signature)

    def _rpc_post(self, payload: Dict) -> Optional[Dict]:
        """Direct JSON-RPC call — fallback when Node.js unavailable."""
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.rpc_url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read()).get("result")
        except Exception as e:
            print(f"  ⚠ RPC error: {e}")
            return None

    def _rpc_get_signatures(self, wallet: str, limit: int) -> List[Dict]:
        result = self._rpc_post({
            "jsonrpc": "2.0", "id": 1,
            "method": "getSignaturesForAddress",
            "params": [wallet, {"limit": min(limit, 1000)}]
        })
        return result or []

    def _rpc_get_transaction(self, signature: str) -> Optional[Dict]:
        return self._rpc_post({
            "jsonrpc": "2.0", "id": 1,
            "method": "getTransaction",
            "params": [signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}]
        })


# ─── Transaction Classifier ───────────────────────────────────────────────────

class TransactionClassifier:
    """
    Classifies raw Solana transactions into tax event types.
    Detects swaps, transfers, staking rewards, LP fees, NFT sales, etc.
    """

    # Known DEX / program IDs
    DEX_PROGRAMS = {
        "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter",
        "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3sFjJ7m": "Orca Whirlpool",
        "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": "Orca V2",
        "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM",
        "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX":  "Serum DEX",
        "MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2pgJe":  "Mercurial",
    }

    STAKE_PROGRAMS = {
        "Stake11111111111111111111111111111111111111112": "Native Stake",
        "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD":  "Marinade",
        "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzf1KQQd3VfEfHQ":  "Solido",
    }

    NFT_PROGRAMS = {
        "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K": "Magic Eden V2",
        "hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk": "Hausmarket",
        "CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz": "Solanart",
    }

    def classify(self, tx: Dict, wallet: str) -> EventType:
        """Determine the tax event type of a transaction."""
        if not tx or tx.get("meta", {}).get("err"):
            return EventType.UNKNOWN

        log_messages = tx.get("meta", {}).get("logMessages", []) or []
        accounts = self._get_accounts(tx)
        programs_invoked = self._get_programs(tx)

        # Check for NFT marketplace activity
        for prog in programs_invoked:
            if prog in self.NFT_PROGRAMS:
                if self._is_seller(tx, wallet):
                    return EventType.NFT_SALE
                return EventType.NFT_MINT

        # Check for staking rewards
        for prog in programs_invoked:
            if prog in self.STAKE_PROGRAMS:
                return EventType.STAKE_REWARD

        # Check for DEX swap
        for prog in programs_invoked:
            if prog in self.DEX_PROGRAMS:
                return EventType.SWAP

        # Check log messages for swap indicators
        logs_lower = " ".join(log_messages).lower()
        if any(kw in logs_lower for kw in ["swap", "exchange", "route", "amm"]):
            return EventType.SWAP

        # LP fee detection
        if any(kw in logs_lower for kw in ["harvest", "collect_fee", "claim"]):
            return EventType.LP_FEE

        # Airdrop: received tokens from unknown source (no prior relationship)
        pre_token = tx.get("meta", {}).get("preTokenBalances", []) or []
        post_token = tx.get("meta", {}).get("postTokenBalances", []) or []
        if not pre_token and post_token:
            return EventType.AIRDROP

        # Transfer detection
        pre_bals = tx.get("meta", {}).get("preBalances", []) or []
        post_bals = tx.get("meta", {}).get("postBalances", []) or []
        if accounts and len(pre_bals) > 0:
            wallet_idx = next((i for i, a in enumerate(accounts) if a == wallet), None)
            if wallet_idx is not None and wallet_idx < len(pre_bals):
                delta = post_bals[wallet_idx] - pre_bals[wallet_idx]
                if delta < 0:
                    return EventType.TRANSFER_OUT
                if delta > 0:
                    return EventType.TRANSFER_IN

        return EventType.UNKNOWN

    def _get_accounts(self, tx: Dict) -> List[str]:
        try:
            msg = tx["transaction"]["message"]
            accs = msg.get("accountKeys", [])
            if accs and isinstance(accs[0], dict):
                return [a["pubkey"] for a in accs]
            return accs or []
        except Exception:
            return []

    def _get_programs(self, tx: Dict) -> List[str]:
        try:
            inner = tx.get("meta", {}).get("innerInstructions", []) or []
            outer = tx["transaction"]["message"].get("instructions", [])
            programs = set()
            for ix in outer:
                pid = ix.get("programId") or ix.get("program")
                if pid:
                    programs.add(pid)
            for group in inner:
                for ix in group.get("instructions", []):
                    pid = ix.get("programId")
                    if pid:
                        programs.add(pid)
            return list(programs)
        except Exception:
            return []

    def _is_seller(self, tx: Dict, wallet: str) -> bool:
        """Determine if wallet is the seller in an NFT transaction."""
        try:
            pre_bals = tx.get("meta", {}).get("preBalances", []) or []
            post_bals = tx.get("meta", {}).get("postBalances", []) or []
            accounts = self._get_accounts(tx)
            idx = next((i for i, a in enumerate(accounts) if a == wallet), None)
            if idx is not None and idx < len(pre_bals):
                return (post_bals[idx] - pre_bals[idx]) > 0  # SOL received = seller
        except Exception:
            pass
        return False


# ─── Cost Basis Engine ────────────────────────────────────────────────────────

class CostBasisEngine:
    """
    Tracks acquisition lots and computes cost basis for disposals.
    Supports FIFO, LIFO, and HIFO methods.
    """

    def __init__(self, method: TaxMethod = TaxMethod.FIFO):
        self.method = method
        # lots[asset] = list of CostBasisLot (sorted by acquired_at)
        self.lots: Dict[str, List[CostBasisLot]] = defaultdict(list)

    def add_lot(self, lot: CostBasisLot):
        """Record a new acquisition lot."""
        self.lots[lot.asset].append(lot)
        # Keep sorted by acquisition time (needed for FIFO/LIFO)
        self.lots[lot.asset].sort(key=lambda l: l.acquired_at)

    def consume(self, asset: str, amount: float, timestamp: int) -> Tuple[float, int]:
        """
        Consume `amount` of `asset` from lots using the configured method.
        Returns (total_cost_basis_usd, holding_days).
        """
        available = self.lots.get(asset, [])
        if not available:
            return 0.0, 0  # No lots = zero cost basis (airdrop, gift, etc.)

        if self.method == TaxMethod.FIFO:
            ordered = list(available)
        elif self.method == TaxMethod.LIFO:
            ordered = list(reversed(available))
        else:  # HIFO
            ordered = sorted(available, key=lambda l: l.cost_per_unit_usd, reverse=True)

        total_cost = 0.0
        remaining = amount
        first_lot_time = None

        new_lots = list(available)

        for lot in ordered:
            if remaining <= 0:
                break
            if first_lot_time is None:
                first_lot_time = lot.acquired_at

            if lot.amount <= remaining:
                total_cost += lot.amount * lot.cost_per_unit_usd
                remaining -= lot.amount
                new_lots.remove(lot)
            else:
                # Partial lot consumption
                total_cost += remaining * lot.cost_per_unit_usd
                lot.amount -= remaining
                remaining = 0

        self.lots[asset] = new_lots

        if remaining > 0:
            # More disposed than we have lots for — zero basis for remainder
            pass

        holding_days = 0
        if first_lot_time:
            holding_days = (timestamp - first_lot_time) // 86400

        return total_cost, holding_days


# ─── Core Tax Engine ──────────────────────────────────────────────────────────

class SolanaTaxEngine:
    """
    Main autonomous tax engine. Orchestrates:
    1. Transaction fetching via @solana/kit (KitFetcher)
    2. Classification (TransactionClassifier)
    3. Pricing (PriceOracle)
    4. Cost basis tracking (CostBasisEngine)
    5. Tax event generation and reporting
    """

    def __init__(
        self,
        rpc_url: str = "https://api.mainnet-beta.solana.com",
        price_api: str = "coingecko",
        method: str = "fifo"
    ):
        self.rpc_url = rpc_url
        self.method = TaxMethod(method.lower())
        self.fetcher = KitFetcher(rpc_url)
        self.classifier = TransactionClassifier()
        self.oracle = PriceOracle(price_api)
        self.basis_engine = CostBasisEngine(self.method)

    def generate_report(
        self,
        wallet: str,
        year: int,
        limit: int = 1000
    ) -> TaxReport:
        """Full tax report for a wallet for a given year."""
        print(f"\n🔍 ClawAi Tax Engine — Wallet: {wallet[:12]}...{wallet[-4:]}")
        print(f"   Year: {year} | Method: {self.method.value.upper()} | Limit: {limit}")
        print("─" * 60)

        # Step 1: Fetch signatures
        print("\n📡 Fetching transaction signatures via @solana/kit...")
        signatures = self.fetcher.get_signatures(wallet, limit)
        print(f"   Found {len(signatures)} transactions total")

        # Step 2: Filter by year
        year_start = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp())
        year_end   = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp())

        year_sigs = [
            s for s in signatures
            if s.get("blockTime") and year_start <= s["blockTime"] < year_end
        ]
        print(f"   {len(year_sigs)} transactions in {year}")

        # Step 3: Process each transaction
        tax_events: List[TaxEvent] = []
        income_events: List[TaxEvent] = []

        print(f"\n⚙️  Processing transactions...")
        for i, sig_info in enumerate(year_sigs):
            sig = sig_info.get("signature", "")
            block_time = sig_info.get("blockTime", 0)

            tx = self.fetcher.get_transaction(sig)
            if not tx:
                continue

            event_type = self.classifier.classify(tx, wallet)
            event = self._process_event(tx, sig, block_time, wallet, event_type)

            if event:
                if event.tax_category == TaxCategory.ORDINARY_INCOME:
                    income_events.append(event)
                elif event.tax_category not in (TaxCategory.NON_TAXABLE, None):
                    tax_events.append(event)

            if (i + 1) % 50 == 0:
                print(f"   Processed {i + 1}/{len(year_sigs)}...")

        # Step 4: Compute totals
        total_gains  = sum(e.gain_loss_usd for e in tax_events if e.gain_loss_usd > 0)
        total_losses = abs(sum(e.gain_loss_usd for e in tax_events if e.gain_loss_usd < 0))
        st_gains = sum(
            e.gain_loss_usd for e in tax_events
            if e.tax_category in (TaxCategory.SHORT_TERM_GAIN, TaxCategory.SHORT_TERM_LOSS)
        )
        lt_gains = sum(
            e.gain_loss_usd for e in tax_events
            if e.tax_category in (TaxCategory.LONG_TERM_GAIN, TaxCategory.LONG_TERM_LOSS)
        )
        total_income = sum(e.proceeds_usd for e in income_events)
        net_gain = total_gains - total_losses

        # Very rough tax estimate (actual depends on total income bracket)
        estimated_tax = (st_gains * 0.37) + (lt_gains * 0.20) + (total_income * 0.37)
        estimated_tax = max(0, estimated_tax)

        report = TaxReport(
            wallet=wallet,
            year=year,
            method=self.method.value,
            generated_at=datetime.utcnow().isoformat() + "Z",
            total_gains=round(total_gains, 2),
            total_losses=round(total_losses, 2),
            net_capital_gain=round(net_gain, 2),
            short_term_gains=round(st_gains, 2),
            long_term_gains=round(lt_gains, 2),
            total_income=round(total_income, 2),
            estimated_tax=round(estimated_tax, 2),
            events=tax_events,
            income_events=income_events,
            summary={
                "transactions_analyzed": len(year_sigs),
                "taxable_events": len(tax_events),
                "income_events": len(income_events),
                "cost_basis_method": self.method.value,
            }
        )

        self._print_report(report)
        return report

    def _process_event(
        self,
        tx: Dict,
        signature: str,
        block_time: int,
        wallet: str,
        event_type: EventType
    ) -> Optional[TaxEvent]:
        """Convert a raw transaction into a priced tax event."""
        if event_type == EventType.UNKNOWN:
            return None

        date_str = datetime.fromtimestamp(block_time, tz=timezone.utc).strftime("%Y-%m-%d")

        # Get SOL delta for the wallet
        accounts = self.classifier._get_accounts(tx)
        pre_bals = tx.get("meta", {}).get("preBalances", []) or []
        post_bals = tx.get("meta", {}).get("postBalances", []) or []
        fee = tx.get("meta", {}).get("fee", 0)

        wallet_idx = next((i for i, a in enumerate(accounts) if a == wallet), None)
        sol_delta = 0.0
        if wallet_idx is not None and wallet_idx < len(pre_bals):
            sol_delta = (post_bals[wallet_idx] - pre_bals[wallet_idx]) / 1e9  # lamports → SOL

        sol_price = self.oracle.get_price_at("SOL", block_time)

        # ── Non-taxable transfers ──────────────────────────────────────────
        if event_type in (EventType.TRANSFER_IN, EventType.WALLET_XFER):
            if sol_delta > 0:
                # Record acquisition lot
                self.basis_engine.add_lot(CostBasisLot(
                    asset="SOL",
                    amount=abs(sol_delta),
                    cost_per_unit_usd=sol_price,
                    acquired_at=block_time,
                    signature=signature
                ))
            return TaxEvent(
                signature=signature,
                timestamp=block_time,
                date=date_str,
                event_type=event_type,
                asset="SOL",
                amount=abs(sol_delta),
                cost_basis_usd=abs(sol_delta) * sol_price,
                proceeds_usd=abs(sol_delta) * sol_price,
                gain_loss_usd=0.0,
                holding_days=0,
                tax_category=TaxCategory.NON_TAXABLE,
                method=self.method.value,
                notes="Inbound transfer — cost basis recorded"
            )

        # ── Income events ─────────────────────────────────────────────────
        if event_type in (EventType.STAKE_REWARD, EventType.LP_FEE, EventType.AIRDROP):
            amount = abs(sol_delta) if sol_delta != 0 else 0.0
            fmv = amount * sol_price
            asset = "SOL" if sol_delta != 0 else self._get_token_received(tx, wallet)

            # Record as new lot at current FMV
            if amount > 0:
                self.basis_engine.add_lot(CostBasisLot(
                    asset=asset,
                    amount=amount,
                    cost_per_unit_usd=sol_price,
                    acquired_at=block_time,
                    signature=signature
                ))

            return TaxEvent(
                signature=signature,
                timestamp=block_time,
                date=date_str,
                event_type=event_type,
                asset=asset,
                amount=amount,
                cost_basis_usd=0.0,       # Income = full amount is proceeds
                proceeds_usd=round(fmv, 4),
                gain_loss_usd=round(fmv, 4),
                holding_days=0,
                tax_category=TaxCategory.ORDINARY_INCOME,
                method=self.method.value,
                notes=f"{event_type.value} at FMV ${sol_price:.2f}/SOL"
            )

        # ── Disposal events (swap, transfer_out, nft_sale) ────────────────
        if event_type in (EventType.SWAP, EventType.TRANSFER_OUT, EventType.NFT_SALE):
            amount = abs(sol_delta)
            if amount == 0:
                return None

            proceeds = amount * sol_price
            cost_basis, holding_days = self.basis_engine.consume("SOL", amount, block_time)

            gain_loss = proceeds - cost_basis

            if holding_days >= 365:
                category = TaxCategory.LONG_TERM_GAIN if gain_loss >= 0 else TaxCategory.LONG_TERM_LOSS
            else:
                category = TaxCategory.SHORT_TERM_GAIN if gain_loss >= 0 else TaxCategory.SHORT_TERM_LOSS

            return TaxEvent(
                signature=signature,
                timestamp=block_time,
                date=date_str,
                event_type=event_type,
                asset="SOL",
                amount=round(amount, 6),
                cost_basis_usd=round(cost_basis, 4),
                proceeds_usd=round(proceeds, 4),
                gain_loss_usd=round(gain_loss, 4),
                holding_days=holding_days,
                tax_category=category,
                method=self.method.value,
                notes=f"Held {holding_days} days | SOL @ ${sol_price:.2f}"
            )

        return None

    def _get_token_received(self, tx: Dict, wallet: str) -> str:
        """Get the token symbol for a token income event."""
        try:
            post = tx.get("meta", {}).get("postTokenBalances", []) or []
            for tb in post:
                if tb.get("owner") == wallet:
                    info = tb.get("uiTokenAmount", {})
                    return tb.get("mint", "UNKNOWN")[:8]
        except Exception:
            pass
        return "TOKEN"

    def export_csv(self, report: TaxReport, output_path: str, fmt: str = "generic"):
        """Export tax events to CSV (TurboTax / TaxAct / generic)."""
        all_events = report.events + report.income_events

        if fmt == "turbotax":
            fieldnames = [
                "Description", "Date Acquired", "Date Sold",
                "Proceeds", "Cost Basis", "Gain or Loss", "Type"
            ]
            rows = []
            for e in all_events:
                rows.append({
                    "Description": f"{e.amount:.6f} {e.asset} ({e.event_type.value})",
                    "Date Acquired": datetime.fromtimestamp(
                        e.timestamp - (e.holding_days * 86400), tz=timezone.utc
                    ).strftime("%m/%d/%Y") if e.holding_days else "Various",
                    "Date Sold": datetime.fromtimestamp(e.timestamp, tz=timezone.utc).strftime("%m/%d/%Y"),
                    "Proceeds": f"{e.proceeds_usd:.2f}",
                    "Cost Basis": f"{e.cost_basis_usd:.2f}",
                    "Gain or Loss": f"{e.gain_loss_usd:.2f}",
                    "Type": "Long-Term" if e.tax_category in (
                        TaxCategory.LONG_TERM_GAIN, TaxCategory.LONG_TERM_LOSS
                    ) else "Short-Term"
                })
        else:
            fieldnames = [
                "date", "signature", "event_type", "asset", "amount",
                "cost_basis_usd", "proceeds_usd", "gain_loss_usd",
                "holding_days", "tax_category", "notes"
            ]
            rows = [
                {
                    "date": e.date,
                    "signature": e.signature[:20] + "...",
                    "event_type": e.event_type.value,
                    "asset": e.asset,
                    "amount": e.amount,
                    "cost_basis_usd": e.cost_basis_usd,
                    "proceeds_usd": e.proceeds_usd,
                    "gain_loss_usd": e.gain_loss_usd,
                    "holding_days": e.holding_days,
                    "tax_category": e.tax_category.value,
                    "notes": e.notes
                }
                for e in all_events
            ]

        with open(output_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        print(f"\n✅ CSV exported: {output_path} ({len(rows)} rows)")

    def export_json(self, report: TaxReport, output_path: str):
        """Export full report as JSON."""
        data = asdict(report)
        # Convert enums to strings
        for e in data.get("events", []) + data.get("income_events", []):
            e["event_type"] = e["event_type"] if isinstance(e["event_type"], str) else e["event_type"].value
            e["tax_category"] = e["tax_category"] if isinstance(e["tax_category"], str) else e["tax_category"].value

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        print(f"\n✅ JSON exported: {output_path}")

    def _print_report(self, report: TaxReport):
        """Print formatted report to console."""
        print("\n" + "═" * 60)
        print(f"🧾 TAX REPORT — {report.year} | {report.wallet[:12]}...")
        print("═" * 60)
        print(f"\n  Cost Basis Method  : {report.method.upper()}")
        print(f"  Transactions       : {report.summary['transactions_analyzed']}")
        print(f"  Taxable Events     : {report.summary['taxable_events']}")
        print(f"  Income Events      : {report.summary['income_events']}")
        print()
        print(f"  💰 Short-Term Gains : ${report.short_term_gains:>12,.2f}")
        print(f"  💰 Long-Term Gains  : ${report.long_term_gains:>12,.2f}")
        print(f"  📉 Total Losses     : ${report.total_losses:>12,.2f}")
        print(f"  ─────────────────────────────────────────")
        print(f"  📊 Net Capital Gain : ${report.net_capital_gain:>12,.2f}")
        print(f"  💵 Ordinary Income  : ${report.total_income:>12,.2f}")
        print()
        print(f"  ⚠️  Est. Tax Owed    : ${report.estimated_tax:>12,.2f}  (rough estimate)")
        print(f"     (Consult a tax professional for accurate figures)")
        print("═" * 60)


# ─── CLI Interface ────────────────────────────────────────────────────────────

def main():
    import sys
    import argparse

    parser = argparse.ArgumentParser(description="ClawAi Solana Tax Engine")
    subparsers = parser.add_subparsers(dest="command")

    # report command
    rep = subparsers.add_parser("report", help="Full annual tax report")
    rep.add_argument("wallet", help="Solana wallet address")
    rep.add_argument("--year", type=int, default=datetime.now().year - 1)
    rep.add_argument("--method", choices=["fifo", "lifo", "hifo"], default="fifo")
    rep.add_argument("--rpc", default="https://api.mainnet-beta.solana.com")
    rep.add_argument("--limit", type=int, default=1000)
    rep.add_argument("--out-csv", help="Export to CSV path")
    rep.add_argument("--out-json", help="Export to JSON path")
    rep.add_argument("--format", choices=["generic", "turbotax"], default="generic")

    # gains command
    gains = subparsers.add_parser("gains", help="Capital gains only")
    gains.add_argument("wallet")
    gains.add_argument("--year", type=int, default=datetime.now().year - 1)
    gains.add_argument("--method", choices=["fifo", "lifo", "hifo"], default="fifo")
    gains.add_argument("--rpc", default="https://api.mainnet-beta.solana.com")

    # income command
    inc = subparsers.add_parser("income", help="Income events only")
    inc.add_argument("wallet")
    inc.add_argument("--year", type=int, default=datetime.now().year - 1)
    inc.add_argument("--rpc", default="https://api.mainnet-beta.solana.com")

    # classify command
    cls = subparsers.add_parser("classify", help="Classify all transactions")
    cls.add_argument("wallet")
    cls.add_argument("--limit", type=int, default=100)
    cls.add_argument("--rpc", default="https://api.mainnet-beta.solana.com")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    engine = SolanaTaxEngine(
        rpc_url=getattr(args, "rpc", "https://api.mainnet-beta.solana.com"),
        method=getattr(args, "method", "fifo")
    )

    if args.command in ("report", "gains", "income"):
        report = engine.generate_report(
            wallet=args.wallet,
            year=args.year,
            limit=getattr(args, "limit", 1000)
        )

        if args.command == "gains":
            print(f"\n🏦 Capital Gains Summary:")
            for e in report.events[:20]:
                print(f"  {e.date}  {e.asset:8} {e.amount:>10.4f}  "
                      f"${e.gain_loss_usd:>10.2f}  {e.tax_category.value}")

        elif args.command == "income":
            print(f"\n💵 Income Events:")
            for e in report.income_events[:20]:
                print(f"  {e.date}  {e.asset:8} ${e.proceeds_usd:>10.2f}  {e.event_type.value}")

        elif args.command == "report":
            if getattr(args, "out_csv", None):
                engine.export_csv(report, args.out_csv, fmt=args.format)
            if getattr(args, "out_json", None):
                engine.export_json(report, args.out_json)

    elif args.command == "classify":
        print(f"\n🔍 Classifying {args.limit} transactions for {args.wallet[:12]}...")
        sigs = engine.fetcher.get_signatures(args.wallet, args.limit)
        counts = defaultdict(int)
        for sig_info in sigs[:args.limit]:
            tx = engine.fetcher.get_transaction(sig_info.get("signature", ""))
            if tx:
                etype = engine.classifier.classify(tx, args.wallet)
                counts[etype.value] += 1

        print(f"\n📊 Transaction Classification:")
        for etype, count in sorted(counts.items(), key=lambda x: -x[1]):
            bar = "█" * min(count, 40)
            print(f"  {etype:<20} {count:>5}  {bar}")


if __name__ == "__main__":
    main()
