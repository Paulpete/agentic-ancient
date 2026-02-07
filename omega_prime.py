#!/usr/bin/env python3
"""
OMEGA PRIME - Main Orchestrator
Autonomous agent for cross-chain operations
"""
import os
import sys
import asyncio
from typing import Dict, List

# Add crypto-agent-omega to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'crypto-agent-omega'))

from agent.intelligence.omega_scanner import OmegaScanner
from agent.strategies.airdrop_hunter import AirdropHunter

class OmegaPrime:
    def __init__(self):
        self.scanner = OmegaScanner()
        self.hunter = AirdropHunter()
        self.config = self.load_allowlist()
    
    def load_allowlist(self) -> Dict:
        """Load allowlist configuration"""
        import json
        with open('configs/allowlists.json', 'r') as f:
            return json.load(f)
    
    async def execute_cycle(self):
        """Execute one Omega cycle"""
        print("🤖 OMEGA PRIME - Executing cycle")
        
        # Scan assets
        target_wallet = os.getenv('TARGET_WALLET', '4eJZV...')
        assets = self.scanner.scan_wallet(target_wallet)
        
        # Hunt airdrops
        eligibility = self.hunter.analyze_eligibility(target_wallet)
        
        print(f"✅ Cycle complete - Assets: {len(assets.get('assets', []))}")
        return assets
    
    async def run_daemon(self):
        """Run eternal loop"""
        print("🔄 OMEGA PRIME - Eternal mode activated")
        while True:
            try:
                await self.execute_cycle()
                await asyncio.sleep(1800)  # 30 minutes
            except Exception as e:
                print(f"⚠️ Error: {e}")
                await asyncio.sleep(60)
    
    async def scan_only(self):
        """Single scan execution"""
        return await self.execute_cycle()

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Omega Prime Orchestrator')
    parser.add_argument('--daemon', action='store_true', help='Run eternal loop')
    parser.add_argument('--scan-only', action='store_true', help='Single scan')
    args = parser.parse_args()
    
    omega = OmegaPrime()
    
    if args.daemon:
        asyncio.run(omega.run_daemon())
    elif args.scan_only:
        asyncio.run(omega.scan_only())
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
