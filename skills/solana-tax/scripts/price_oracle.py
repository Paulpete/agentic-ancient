#!/usr/bin/env python3
"""
Price Oracle — Historical token price lookup for tax calculations.
Supports CoinGecko (free), Birdeye (Solana-native), Jupiter Price API.
"""
import json
import time
import urllib.request
from typing import Optional, Dict
from datetime import datetime, timezone
from pathlib import Path


class PriceCache:
    """Persistent price cache to avoid redundant API calls."""

    def __init__(self, cache_file: str = "/tmp/clawai_price_cache.json"):
        self.cache_file = Path(cache_file)
        self._cache: Dict[str, float] = self._load()

    def _load(self) -> Dict[str, float]:
        if self.cache_file.exists():
            try:
                with open(self.cache_file) as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def save(self):
        with open(self.cache_file, "w") as f:
            json.dump(self._cache, f)

    def get(self, key: str) -> Optional[float]:
        return self._cache.get(key)

    def set(self, key: str, value: float):
        self._cache[key] = value
        self.save()


class MultiOracle:
    """
    Multi-source historical price oracle.
    Try order: 1) Cache → 2) CoinGecko → 3) Jupiter → 4) Birdeye
    """

    # Token mint → CoinGecko ID mapping
    MINT_TO_COINGECKO: Dict[str, str] = {
        "So11111111111111111111111111111111111111112":  "solana",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "usd-coin",
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB":  "tether",
        "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":  "jupiter-exchange-solana",
        "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263":  "bonk",
        "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm":  "dogwifcoin",
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R":  "raydium",
        "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE":   "orca",
        "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac":   "mango-markets",
        "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs":  "ethereum",
    }

    # Stablecoins always $1
    STABLECOINS = {
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",   # USDT
        "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX":    # USDH
        "UST":
        "USDR":
    }

    def __init__(self, birdeye_api_key: Optional[str] = None):
        self.cache = PriceCache()
        self.birdeye_key = birdeye_api_key
        self._rate_limit_ts = 0.0

    def get_price(self, mint_or_symbol: str, timestamp: int) -> float:
        """
        Get USD price for a token at a given Unix timestamp.
        mint_or_symbol: Solana mint address or symbol like "SOL", "USDC"
        """
        # Stablecoins
        if mint_or_symbol in self.STABLECOINS or mint_or_symbol.upper() in ("USDC", "USDT", "DAI", "USDH"):
            return 1.0

        # SOL by symbol
        if mint_or_symbol.upper() == "SOL":
            mint_or_symbol = "So11111111111111111111111111111111111111112"

        cache_key = f"{mint_or_symbol}:{timestamp // 3600}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        price = (
            self._coingecko_price(mint_or_symbol, timestamp) or
            self._jupiter_price(mint_or_symbol) or
            self._birdeye_price(mint_or_symbol, timestamp) or
            0.0
        )

        self.cache.set(cache_key, price)
        return price

    def _coingecko_price(self, mint: str, timestamp: int) -> Optional[float]:
        """CoinGecko historical price (free tier, ~50 req/min)."""
        coin_id = self.MINT_TO_COINGECKO.get(mint)
        if not coin_id:
            return None

        # Respect rate limit
        elapsed = time.time() - self._rate_limit_ts
        if elapsed < 1.2:
            time.sleep(1.2 - elapsed)
        self._rate_limit_ts = time.time()

        date_str = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%d-%m-%Y")
        url = (
            f"https://api.coingecko.com/api/v3/coins/{coin_id}/history"
            f"?date={date_str}&localization=false"
        )

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ClawAi-TaxEngine/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                return float(data["market_data"]["current_price"]["usd"])
        except Exception:
            return None

    def _jupiter_price(self, mint: str) -> Optional[float]:
        """
        Jupiter Price API — real-time price (use as fallback for recent txns).
        Note: Not historical, but useful for recent transactions where
        historical data may be unavailable.
        """
        url = f"https://price.jup.ag/v6/price?ids={mint}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ClawAi-TaxEngine/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read())
                return float(data["data"][mint]["price"])
        except Exception:
            return None

    def _birdeye_price(self, mint: str, timestamp: int) -> Optional[float]:
        """Birdeye historical OHLCV — requires API key."""
        if not self.birdeye_key:
            return None

        # Convert timestamp to nearest hour
        ts = (timestamp // 3600) * 3600
        url = (
            f"https://public-api.birdeye.so/defi/history_price"
            f"?address={mint}&address_type=token&type=1H"
            f"&time_from={ts - 3600}&time_to={ts + 3600}"
        )

        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "ClawAi-TaxEngine/1.0",
                    "X-API-KEY": self.birdeye_key
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                items = data.get("data", {}).get("items", [])
                if items:
                    return float(items[0].get("value", 0))
        except Exception:
            return None
        return None


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    import sys

    if len(sys.argv) < 3:
        print("Usage: price_oracle.py <mint_or_symbol> <unix_timestamp>")
        print("Examples:")
        print("  price_oracle.py SOL 1704067200")
        print("  price_oracle.py EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 1704067200")
        sys.exit(1)

    mint = sys.argv[1]
    ts   = int(sys.argv[2])

    oracle = MultiOracle()
    price  = oracle.get_price(mint, ts)

    date_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
    print(f"\n💲 Price of {mint[:20]} on {date_str}: ${price:.4f} USD")


if __name__ == "__main__":
    main()
