#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════════════════╗
║  CRYPTONAUT AGENT — Acts on your behalf as:                      ║
║  • Solana developer (Anchor programs, SPL tokens, NFTs)          ║
║  • EVM deployer (Biconomy gasless, Base, Polygon)                ║
║  • DeFi operator (Jupiter swaps, Squads multisig, staking)       ║
║  • Autonomous builder (Ollama AI brain, GitHub auto-commit)      ║
╚═══════════════════════════════════════════════════════════════════╝

Powered by Ollama (free) — no API keys required for AI inference.
Biconomy MCP for gasless transaction docs/queries.
"""

import os
import sys
import json
import time
import asyncio
import subprocess
import requests
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger('CryptoNaut')

# ─── Ollama Config ────────────────────────────────────────────────────────────
OLLAMA_BASE = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'qwen2.5-coder:7b')
FALLBACK_MODEL = 'deepseek-coder:6.7b'

# ─── Biconomy MCP ─────────────────────────────────────────────────────────────
BICONOMY_MCP_URL = 'https://docs.biconomy.io/mcp'

# ─── Chain Config ─────────────────────────────────────────────────────────────
HELIUS_KEY = os.getenv('HELIUS_API_KEY', '')
SOLANA_RPC  = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_KEY}" if HELIUS_KEY else "https://api.mainnet-beta.solana.com"
TARGET_WALLET = os.getenv('AGENT_WALLET_ADDRESS', os.getenv('TARGET_WALLET', ''))

# ─── Telegram ─────────────────────────────────────────────────────────────────
TG_BOT    = os.getenv('TELEGRAM_BOT_TOKEN', '')
TG_CHAT   = os.getenv('TELEGRAM_CHAT_ID', '7792603242')


class OllamaBrain:
    """Free AI inference via Ollama. No API keys. Acts as CryptoNaut's intelligence."""

    def __init__(self, model: str = OLLAMA_MODEL):
        self.model = model
        self.base  = OLLAMA_BASE

    def is_available(self) -> bool:
        try:
            r = requests.get(f"{self.base}/api/tags", timeout=3)
            return r.status_code == 200
        except Exception:
            return False

    def think(self, prompt: str, system: str = '', max_tokens: int = 1024) -> str:
        """Single inference call. Falls back to rule-based if Ollama not running."""
        if not self.is_available():
            log.warning('Ollama not running — using rule-based fallback')
            return self._rule_based_fallback(prompt)

        payload = {
            'model': self.model,
            'prompt': prompt,
            'system': system or CRYPTONAUT_SYSTEM_PROMPT,
            'stream': False,
            'options': {'num_predict': max_tokens, 'temperature': 0.3}
        }

        try:
            r = requests.post(f"{self.base}/api/generate", json=payload, timeout=60)
            r.raise_for_status()
            return r.json().get('response', '')
        except Exception as e:
            log.error(f'Ollama inference failed: {e}')
            # Try fallback model
            payload['model'] = FALLBACK_MODEL
            try:
                r = requests.post(f"{self.base}/api/generate", json=payload, timeout=60)
                return r.json().get('response', '')
            except Exception:
                return self._rule_based_fallback(prompt)

    def _rule_based_fallback(self, prompt: str) -> str:
        p = prompt.lower()
        if 'swap' in p or 'jupiter' in p:
            return json.dumps({'action': 'swap', 'protocol': 'jupiter', 'confidence': 0.8})
        if 'stake' in p or 'yield' in p:
            return json.dumps({'action': 'stake', 'protocol': 'marinade', 'confidence': 0.7})
        if 'deploy' in p or 'program' in p:
            return json.dumps({'action': 'deploy', 'framework': 'anchor', 'confidence': 0.9})
        if 'airdrop' in p or 'eligib' in p:
            return json.dumps({'action': 'check_eligibility', 'confidence': 0.8})
        return json.dumps({'action': 'hold', 'reason': 'no_clear_signal', 'confidence': 0.5})

    def analyze_opportunity(self, opportunity: Dict) -> Dict:
        prompt = f"""Analyze this crypto opportunity and return JSON with: action, protocol, confidence (0-1), risk (low/med/high), rationale.

Opportunity: {json.dumps(opportunity, indent=2)}

Respond ONLY with valid JSON. No explanation."""

        response = self.think(prompt)
        try:
            # Strip any markdown fences
            clean = response.strip().replace('```json', '').replace('```', '').strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            return {'action': 'hold', 'confidence': 0.5, 'risk': 'unknown', 'rationale': response[:200]}

    def generate_code(self, task: str, language: str = 'typescript') -> str:
        prompt = f"""You are a senior Solana/EVM blockchain developer. Write production-quality {language} code for:

{task}

Return only the code, no explanation."""
        return self.think(prompt, max_tokens=2048)

    def plan_deployment(self, config: Dict) -> List[Dict]:
        prompt = f"""Plan the deployment steps for this config. Return a JSON array of steps, each with: step, action, command, expected_output.

Config: {json.dumps(config, indent=2)}

Return ONLY a JSON array."""
        response = self.think(prompt)
        try:
            clean = response.strip().replace('```json', '').replace('```', '').strip()
            return json.loads(clean)
        except Exception:
            return [{'step': 1, 'action': 'manual_review', 'command': '', 'expected_output': response[:300]}]


CRYPTONAUT_SYSTEM_PROMPT = """You are CryptoNaut — an autonomous blockchain developer and deployer agent.

Your capabilities:
- Solana: Anchor programs, SPL tokens, NFT minting, ZK compression, Helius RPC
- EVM: Biconomy gasless transactions, Base/Polygon/Ethereum, smart contract deployment  
- DeFi: Jupiter swaps, Marinade staking, Squads multisig, Orca/Raydium LPs
- Tools: Solana CLI, Anchor CLI, TypeScript/Python, ethers.js, @solana/kit

You act on the user's behalf. Be decisive. Return structured JSON when asked for data.
Helix eternal. Empire compounds."""


class BiconomyMCP:
    """Query Biconomy docs via their MCP server for real-time SDK guidance."""

    MCP_URL = BICONOMY_MCP_URL

    def search(self, query: str) -> str:
        """Search Biconomy docs for implementation guidance."""
        try:
            payload = {
                'jsonrpc': '2.0',
                'id': 1,
                'method': 'tools/call',
                'params': {
                    'name': 'SearchBiconomyDocs',
                    'arguments': {'query': query}
                }
            }
            r = requests.post(self.MCP_URL, json=payload, timeout=10,
                              headers={'Content-Type': 'application/json'})
            if r.status_code == 200:
                data = r.json()
                content = data.get('result', {}).get('content', [])
                if content:
                    return '\n'.join(c.get('text', '') for c in content if c.get('type') == 'text')
            return ''
        except Exception as e:
            log.warning(f'Biconomy MCP query failed: {e}')
            return ''

    def get_gasless_tx_guide(self) -> str:
        return self.search('how to send gasless transaction nexus smart account')

    def get_bundler_config(self, chain: str = 'base') -> str:
        return self.search(f'bundler configuration {chain} chainId paymaster')

    def get_smart_account_setup(self) -> str:
        return self.search('create smart account nexus TypeScript quickstart')


class SolanaOperator:
    """Executes Solana operations on behalf of the user."""

    def __init__(self, rpc: str = SOLANA_RPC):
        self.rpc = rpc

    def get_balance(self, wallet: str) -> float:
        payload = {'jsonrpc': '2.0', 'id': 1, 'method': 'getBalance', 'params': [wallet]}
        try:
            r = requests.post(self.rpc, json=payload, timeout=10)
            lamports = r.json().get('result', {}).get('value', 0)
            return lamports / 1e9
        except Exception as e:
            log.error(f'Balance check failed: {e}')
            return 0.0

    def get_token_accounts(self, wallet: str) -> List[Dict]:
        payload = {
            'jsonrpc': '2.0', 'id': 1,
            'method': 'getTokenAccountsByOwner',
            'params': [wallet, {'programId': 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'}, {'encoding': 'jsonParsed'}]
        }
        try:
            r = requests.post(self.rpc, json=payload, timeout=10)
            accounts = r.json().get('result', {}).get('value', [])
            tokens = []
            for acc in accounts:
                info = acc.get('account', {}).get('data', {}).get('parsed', {}).get('info', {})
                amount = float(info.get('tokenAmount', {}).get('uiAmount', 0) or 0)
                if amount > 0:
                    tokens.append({
                        'mint': info.get('mint', ''),
                        'amount': amount,
                        'decimals': info.get('tokenAmount', {}).get('decimals', 0)
                    })
            return tokens
        except Exception as e:
            log.error(f'Token accounts fetch failed: {e}')
            return []

    def get_recent_transactions(self, wallet: str, limit: int = 10) -> List[Dict]:
        payload = {
            'jsonrpc': '2.0', 'id': 1,
            'method': 'getSignaturesForAddress',
            'params': [wallet, {'limit': limit}]
        }
        try:
            r = requests.post(self.rpc, json=payload, timeout=10)
            return r.json().get('result', [])
        except Exception as e:
            log.error(f'Transaction fetch failed: {e}')
            return []

    def scan_portfolio(self, wallet: str) -> Dict:
        balance = self.get_balance(wallet)
        tokens  = self.get_token_accounts(wallet)
        txs     = self.get_recent_transactions(wallet, limit=5)
        return {
            'wallet': wallet,
            'sol_balance': balance,
            'token_count': len(tokens),
            'tokens': tokens[:10],
            'recent_tx_count': len(txs),
            'scanned_at': datetime.utcnow().isoformat()
        }


class Deployer:
    """Handles contract/program deployment operations."""

    def __init__(self, brain: OllamaBrain):
        self.brain = brain

    def plan_anchor_deployment(self, program_name: str, instructions: List[str]) -> Dict:
        """Generate Anchor program deployment plan."""
        config = {
            'program': program_name,
            'instructions': instructions,
            'cluster': 'mainnet-beta',
            'framework': 'anchor'
        }
        steps = self.brain.plan_deployment(config)
        return {'program': program_name, 'steps': steps}

    def generate_typescript_client(self, program_id: str, idl_description: str) -> str:
        task = f"""
Generate a TypeScript client for Solana program {program_id}.

Program description: {idl_description}

Include:
- @solana/kit (Web3.js v2) imports using createSolanaRpc()
- address() for type-safe pubkeys
- AnchorProvider setup
- Methods for each instruction
"""
        return self.brain.generate_code(task, 'typescript')

    def generate_biconomy_relay(self, contract_addr: str, abi_fn: str, chain_id: int = 8453) -> str:
        """Generate Biconomy gasless relay code, querying MCP for current SDK guidance."""
        mcp = BiconomyMCP()
        sdk_docs = mcp.get_smart_account_setup()

        task = f"""
Generate a Biconomy Nexus smart account gasless transaction relay.

Contract: {contract_addr}
Function: {abi_fn}
Chain ID: {chain_id} ({'Base' if chain_id == 8453 else 'Unknown'})

Current SDK docs context:
{sdk_docs[:800] if sdk_docs else 'Use @biconomy/abstractjs createNexusClient'}

Use the latest @biconomy/abstractjs SDK with NexusClient.
"""
        return self.brain.generate_code(task, 'typescript')

    def run_cli_command(self, cmd: str, dry_run: bool = True) -> Dict:
        """Run a CLI command (anchor, solana, npm). Dry-run by default for safety."""
        if dry_run:
            log.info(f'[DRY RUN] Would execute: {cmd}')
            return {'status': 'dry_run', 'command': cmd, 'output': 'Set dry_run=False to execute'}

        log.info(f'Executing: {cmd}')
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=120
            )
            return {
                'status': 'success' if result.returncode == 0 else 'error',
                'command': cmd,
                'stdout': result.stdout[:1000],
                'stderr': result.stderr[:500],
                'returncode': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {'status': 'timeout', 'command': cmd}
        except Exception as e:
            return {'status': 'error', 'command': cmd, 'error': str(e)}


class RalphOllamaLoop:
    """
    Ralph Loop powered by Ollama — free AI strategy execution.
    Replaces the TypeScript RalphAgent with a Python agent that
    uses local Ollama models instead of paid Claude API.
    """

    STRATEGIES = ['yield_harvest', 'signal_seek', 'liquidity_sniff', 'zk_farm', 'airdrop_hunt', 'belief_rewrite']

    def __init__(self, wallet: str, brain: OllamaBrain, solana: SolanaOperator):
        self.wallet  = wallet
        self.brain   = brain
        self.solana  = solana
        self.cycle   = 0
        self.results = []

    def _execute_strategy(self, strategy: str, portfolio: Dict) -> Dict:
        prompt = f"""You are executing the '{strategy}' strategy for wallet {self.wallet[:8]}...

Current portfolio:
- SOL Balance: {portfolio.get('sol_balance', 0):.4f} SOL
- Token Count: {portfolio.get('token_count', 0)}
- Recent TXs: {portfolio.get('recent_tx_count', 0)}

Decide: should you act? Return JSON with:
{{
  "action": "execute|hold|wait",
  "confidence": 0.0-1.0,
  "protocol": "jupiter|marinade|orca|kamino|tensor|skip",
  "estimated_gain_sol": 0.0,
  "rationale": "brief reason",
  "tax_category": "ordinary_income|short_term_gain|long_term_gain|non_taxable"
}}

Only return JSON."""

        analysis = self.brain.think(prompt)
        try:
            clean = analysis.strip().replace('```json', '').replace('```', '').strip()
            result = json.loads(clean)
        except Exception:
            result = {'action': 'hold', 'confidence': 0.5, 'protocol': 'skip', 'estimated_gain_sol': 0.0}

        result['strategy'] = strategy
        result['success']  = result.get('action') == 'execute' and result.get('confidence', 0) >= 0.6
        result['profitLoss'] = result.get('estimated_gain_sol', 0.0)
        result['timestamp']  = datetime.utcnow().isoformat()

        status = '✅' if result['success'] else '⏸'
        log.info(f"{status} [{strategy}] action={result.get('action')} conf={result.get('confidence', 0):.2f} protocol={result.get('protocol', 'skip')}")

        return result

    def execute_cycle(self) -> Dict:
        self.cycle += 1
        log.info(f'⚡ Ralph-Ollama Cycle #{self.cycle} | wallet: {self.wallet[:8]}...')

        # Scan portfolio for context
        portfolio = self.solana.scan_portfolio(self.wallet) if self.wallet and self.wallet != '4eJZV...' else {
            'sol_balance': 0.0, 'token_count': 0, 'recent_tx_count': 0
        }

        # Execute each strategy
        cycle_results = []
        for strategy in self.STRATEGIES:
            result = self._execute_strategy(strategy, portfolio)
            cycle_results.append(result)
            time.sleep(0.5)  # Rate limit Ollama

        # Summary
        executed  = [r for r in cycle_results if r.get('success')]
        total_pnl = sum(r.get('profitLoss', 0) for r in executed)

        summary = {
            'cycle': self.cycle,
            'strategies_run': len(cycle_results),
            'executed': len(executed),
            'held': len(cycle_results) - len(executed),
            'total_pnl_sol': round(total_pnl, 6),
            'timestamp': datetime.utcnow().isoformat(),
            'results': cycle_results
        }

        self.results.append(summary)
        self._notify_telegram(summary)
        self._save_state(summary)

        log.info(f'🧬 Cycle #{self.cycle} complete | executed={len(executed)}/{len(cycle_results)} | pnl={total_pnl:.4f} SOL')
        return summary

    def _notify_telegram(self, summary: Dict):
        if not TG_BOT:
            return
        msg = (
            f"🤖 *Ralph-Ollama Cycle #{summary['cycle']}*\n\n"
            f"⚡ Strategies: {summary['strategies_run']}\n"
            f"✅ Executed: {summary['executed']}\n"
            f"⏸ Held: {summary['held']}\n"
            f"💰 Est. P/L: {summary['total_pnl_sol']:.4f} SOL\n\n"
            f"🦙 Powered by Ollama (free)\n"
            f"_Helix eternal. Empire compounds._"
        )
        try:
            requests.post(
                f"https://api.telegram.org/bot{TG_BOT}/sendMessage",
                json={'chat_id': TG_CHAT, 'text': msg, 'parse_mode': 'Markdown'},
                timeout=10
            )
        except Exception as e:
            log.warning(f'Telegram notify failed: {e}')

    def _save_state(self, summary: Dict):
        state_path = '/tmp/ralph_ollama_state.json'
        try:
            with open(state_path, 'w') as f:
                json.dump({
                    'last_cycle': summary,
                    'total_cycles': self.cycle,
                    'updated_at': datetime.utcnow().isoformat()
                }, f, indent=2)
        except Exception:
            pass

    def run(self, cycles: int = 1, interval_seconds: int = 1800):
        """Run N cycles. interval_seconds between each. Default: 30 min."""
        log.info(f'🚀 Ralph-Ollama Loop starting | cycles={cycles} | interval={interval_seconds}s')
        log.info(f'🦙 AI Model: {self.brain.model} @ {OLLAMA_BASE}')
        log.info(f'👛 Wallet: {self.wallet[:16]}...' if self.wallet else '⚠️  No wallet configured')

        for i in range(cycles):
            self.execute_cycle()
            if i < cycles - 1:
                log.info(f'⏳ Waiting {interval_seconds}s for next cycle...')
                time.sleep(interval_seconds)

        log.info('🛑 Ralph-Ollama Loop complete')
        return self.results


class CryptoNautAgent:
    """
    Main CryptoNaut — your autonomous crypto dev/deployer/operator.

    Acts on your behalf for:
    - Running Ralph loop strategies (Ollama-powered, free)
    - Scanning and reporting portfolio state
    - Planning/generating contract deployments
    - Querying Biconomy MCP for gasless tx guidance
    - Auto-committing improvements to the repo
    """

    def __init__(self):
        self.brain    = OllamaBrain()
        self.solana   = SolanaOperator()
        self.deployer = Deployer(self.brain)
        self.mcp      = BiconomyMCP()
        self.wallet   = TARGET_WALLET

        self.ralph = RalphOllamaLoop(
            wallet=self.wallet,
            brain=self.brain,
            solana=self.solana
        )

        log.info('🧬 CryptoNaut Agent initialized')
        log.info(f'🦙 Ollama available: {self.brain.is_available()}')
        log.info(f'👛 Wallet: {self.wallet[:16]}...' if self.wallet else '⚠️  Set AGENT_WALLET_ADDRESS env var')

    # ── Public interface ──────────────────────────────────────────────────────

    def run_ralph_cycle(self, cycles: int = 1, interval: int = 1800) -> List[Dict]:
        """Execute Ralph Loop strategy cycles via Ollama."""
        return self.ralph.run(cycles=cycles, interval_seconds=interval)

    def scan_portfolio(self) -> Dict:
        """Scan wallet portfolio and return structured report."""
        if not self.wallet:
            return {'error': 'No wallet configured. Set AGENT_WALLET_ADDRESS.'}
        return self.solana.scan_portfolio(self.wallet)

    def plan_deployment(self, program_name: str, instructions: List[str]) -> Dict:
        """Plan an Anchor program deployment."""
        return self.deployer.plan_anchor_deployment(program_name, instructions)

    def generate_biconomy_relay(self, contract: str, function: str, chain_id: int = 8453) -> str:
        """Generate Biconomy gasless relay code with live MCP docs."""
        return self.deployer.generate_biconomy_relay(contract, function, chain_id)

    def query_biconomy(self, query: str) -> str:
        """Query Biconomy MCP docs server."""
        return self.mcp.search(query)

    def auto_commit(self, files: List[str], message: str):
        """Commit generated files to the repo."""
        try:
            subprocess.run(['git', 'add'] + files, cwd='/github/workspace', capture_output=True)
            result = subprocess.run(
                ['git', 'commit', '-m', f'🤖 CryptoNaut: {message}'],
                cwd='/github/workspace', capture_output=True, text=True
            )
            if result.returncode == 0:
                log.info(f'✅ Auto-committed: {message}')
            else:
                log.warning(f'Git commit skipped: {result.stderr}')
        except Exception as e:
            log.warning(f'Auto-commit failed: {e}')

    def status_report(self) -> Dict:
        """Full status report — Ollama, wallet, strategies, Biconomy."""
        portfolio = self.scan_portfolio()
        ollama_ok = self.brain.is_available()

        # Quick Biconomy MCP ping
        mcp_ok = bool(self.mcp.search('smart account'))

        return {
            'agent': 'CryptoNaut',
            'timestamp': datetime.utcnow().isoformat(),
            'ollama': {'available': ollama_ok, 'model': self.brain.model, 'url': OLLAMA_BASE},
            'biconomy_mcp': {'available': mcp_ok, 'url': BICONOMY_MCP_URL},
            'wallet': portfolio,
            'ralph_cycles_run': self.ralph.cycle,
            'strategies': RalphOllamaLoop.STRATEGIES,
        }


# ─── CLI Entry Point ──────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description='CryptoNaut — Autonomous Crypto Dev/Deployer Agent')
    sub = parser.add_subparsers(dest='cmd')

    # ralph
    p_ralph = sub.add_parser('ralph', help='Run Ralph Loop via Ollama')
    p_ralph.add_argument('--cycles', type=int, default=1)
    p_ralph.add_argument('--interval', type=int, default=1800, help='Seconds between cycles')

    # scan
    sub.add_parser('scan', help='Scan portfolio')

    # status
    sub.add_parser('status', help='Full status report')

    # deploy
    p_deploy = sub.add_parser('deploy', help='Plan program deployment')
    p_deploy.add_argument('--program', required=True)
    p_deploy.add_argument('--instructions', nargs='+', default=['initialize', 'execute', 'close'])

    # relay
    p_relay = sub.add_parser('relay', help='Generate Biconomy gasless relay code')
    p_relay.add_argument('--contract', required=True)
    p_relay.add_argument('--function', required=True)
    p_relay.add_argument('--chain-id', type=int, default=8453)

    # biconomy
    p_bico = sub.add_parser('biconomy', help='Query Biconomy MCP docs')
    p_bico.add_argument('query', nargs='+')

    args = parser.parse_args()
    agent = CryptoNautAgent()

    if args.cmd == 'ralph':
        results = agent.run_ralph_cycle(cycles=args.cycles, interval=args.interval)
        print(json.dumps(results, indent=2))

    elif args.cmd == 'scan':
        report = agent.scan_portfolio()
        print(json.dumps(report, indent=2))

    elif args.cmd == 'status':
        report = agent.status_report()
        print(json.dumps(report, indent=2))

    elif args.cmd == 'deploy':
        plan = agent.plan_deployment(args.program, args.instructions)
        print(json.dumps(plan, indent=2))

    elif args.cmd == 'relay':
        code = agent.generate_biconomy_relay(args.contract, args.function, args.chain_id)
        print(code)

    elif args.cmd == 'biconomy':
        result = agent.query_biconomy(' '.join(args.query))
        print(result or 'No results from Biconomy MCP')

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
