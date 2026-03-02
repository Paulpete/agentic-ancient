#!/usr/bin/env python3
"""
ClawAi Autonomous Integration — Solana Tax Skill
Connects the tax engine to ClawAi's autonomous loop via Helix Nexus.

Usage within ClawAi:
    from scripts.clawai_integration import ClawAiTaxAgent
    agent = ClawAiTaxAgent()
    result = agent.run("Generate a 2024 tax report for wallet XYZ with HIFO method")
"""
import json
import re
import urllib.request
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime


# Import tax engine
import sys
sys.path.insert(0, str(Path(__file__).parent))
from tax_engine import SolanaTaxEngine, TaxReport, TaxMethod


class ClawAiTaxAgent:
    """
    Autonomous tax agent for ClawAi.
    Understands natural language tax requests and executes them.
    Integrates with Helix Nexus for orchestration + webapp reporting.
    """

    def __init__(
        self,
        rpc_url: str = "https://api.mainnet-beta.solana.com",
        webapp_url: Optional[str] = None,
        anthropic_api_key: Optional[str] = None
    ):
        self.rpc_url = rpc_url
        self.webapp_url = webapp_url
        self.anthropic_key = anthropic_api_key

    def run(self, natural_language_request: str) -> Dict[str, Any]:
        """
        Main entry point for ClawAi autonomous execution.
        Parses NL request → extracts params → runs tax engine → returns report.

        Examples:
          "Generate 2024 tax report for wallet ABC123 using FIFO"
          "What are my capital gains for wallet XYZ in 2023?"
          "Calculate staking income for wallet DEF for last year"
          "Export TurboTax CSV for wallet GHI for 2024"
        """
        print(f"\n🤖 ClawAi Tax Agent — Processing: {natural_language_request[:80]}")

        # Extract parameters
        params = self._parse_request(natural_language_request)
        print(f"   Parsed: wallet={params.get('wallet', '?')[:12]}... "
              f"year={params.get('year')} method={params.get('method')}")

        if not params.get("wallet"):
            return {
                "error": "No wallet address found in request",
                "hint": "Include a Solana wallet address in your request"
            }

        # Run tax engine
        engine = SolanaTaxEngine(
            rpc_url=self.rpc_url,
            method=params.get("method", "fifo")
        )

        report = engine.generate_report(
            wallet=params["wallet"],
            year=params.get("year", datetime.now().year - 1),
            limit=params.get("limit", 1000)
        )

        # Export if requested
        result = self._build_result(report, engine, params)

        # Notify Helix Nexus webapp
        if self.webapp_url:
            self._notify_webapp(result)

        return result

    def _parse_request(self, request: str) -> Dict[str, Any]:
        """Extract structured parameters from a natural language request."""
        params: Dict[str, Any] = {}

        # Extract Solana wallet address (base58, 32-44 chars)
        wallet_match = re.search(r'\b[1-9A-HJ-NP-Za-km-z]{32,44}\b', request)
        if wallet_match:
            params["wallet"] = wallet_match.group(0)

        # Extract year
        year_match = re.search(r'\b(20\d{2})\b', request)
        if year_match:
            params["year"] = int(year_match.group(1))
        elif "last year" in request.lower():
            params["year"] = datetime.now().year - 1
        else:
            params["year"] = datetime.now().year - 1

        # Extract cost basis method
        req_lower = request.lower()
        if "hifo" in req_lower or "highest" in req_lower:
            params["method"] = "hifo"
        elif "lifo" in req_lower or "last in" in req_lower:
            params["method"] = "lifo"
        else:
            params["method"] = "fifo"

        # Detect export format
        if "turbotax" in req_lower or "turbo tax" in req_lower:
            params["export_format"] = "turbotax"
        elif "csv" in req_lower:
            params["export_format"] = "csv"
        elif "json" in req_lower:
            params["export_format"] = "json"

        # Detect focus area
        if "income" in req_lower or "staking" in req_lower or "airdrop" in req_lower:
            params["focus"] = "income"
        elif "gain" in req_lower or "loss" in req_lower:
            params["focus"] = "gains"
        else:
            params["focus"] = "full"

        return params

    def _build_result(
        self,
        report: TaxReport,
        engine: SolanaTaxEngine,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build the result object and handle exports."""
        output_dir = Path("/tmp/clawai_tax_reports")
        output_dir.mkdir(exist_ok=True)

        result = {
            "status": "success",
            "wallet": report.wallet,
            "year": report.year,
            "method": report.method,
            "generated_at": report.generated_at,
            "summary": {
                "net_capital_gain": report.net_capital_gain,
                "short_term_gains": report.short_term_gains,
                "long_term_gains": report.long_term_gains,
                "total_income": report.total_income,
                "estimated_tax": report.estimated_tax,
                "transactions_analyzed": report.summary["transactions_analyzed"],
                "taxable_events": report.summary["taxable_events"],
                "income_events": report.summary["income_events"],
            },
            "exports": {}
        }

        # Auto-export based on request
        fmt = params.get("export_format")
        base = f"tax_{report.wallet[:8]}_{report.year}_{report.method}"

        if fmt in ("csv", "turbotax", None):
            csv_path = output_dir / f"{base}.csv"
            engine.export_csv(report, str(csv_path), fmt=fmt or "generic")
            result["exports"]["csv"] = str(csv_path)

        if fmt == "json" or fmt is None:
            json_path = output_dir / f"{base}.json"
            engine.export_json(report, str(json_path))
            result["exports"]["json"] = str(json_path)

        return result

    def _notify_webapp(self, result: Dict[str, Any]):
        """Send tax report summary to Helix Nexus webapp."""
        payload = {
            "type": "task_execution",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "data": {
                "task_id": f"tax_{result.get('wallet', '')[:8]}_{result.get('year')}",
                "skill": "solana-tax",
                "result": "Tax report generated",
                "summary": result.get("summary", {}),
                "success": result.get("status") == "success",
            },
            "source": "clawai-tax-engine"
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.webapp_url}/api/helix/status",
                data=data,
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            pass  # Non-blocking — webapp notification is best-effort

    def batch_wallets(self, wallets: list, year: int, method: str = "fifo") -> Dict[str, Any]:
        """Process multiple wallets in sequence — useful for portfolio-wide tax reports."""
        results = {}
        total_gains = 0.0
        total_income = 0.0

        for wallet in wallets:
            print(f"\n{'─'*40}")
            print(f"Processing wallet {wallets.index(wallet)+1}/{len(wallets)}: {wallet[:12]}...")
            result = self.run(f"Generate {year} tax report for wallet {wallet} using {method}")
            results[wallet] = result
            if result.get("status") == "success":
                total_gains  += result["summary"].get("net_capital_gain", 0)
                total_income += result["summary"].get("total_income", 0)

        return {
            "batch_summary": {
                "wallets": len(wallets),
                "year": year,
                "total_net_capital_gain": round(total_gains, 2),
                "total_income": round(total_income, 2),
                "estimated_combined_tax": round((total_gains * 0.25) + (total_income * 0.37), 2)
            },
            "per_wallet": results
        }


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: clawai_integration.py '<natural language request>'")
        print()
        print("Examples:")
        print('  python3 clawai_integration.py "Generate 2024 tax report for wallet YourWalletHere using FIFO"')
        print('  python3 clawai_integration.py "What are my staking gains for wallet ABC in 2023?"')
        sys.exit(1)

    request = " ".join(sys.argv[1:])
    agent = ClawAiTaxAgent()
    result = agent.run(request)

    print("\n📋 Agent Result:")
    print(json.dumps(result, indent=2))
