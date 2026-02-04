import asyncio
import os
from dotenv import load_dotenv
from src.cosmic_intel import CosmicIntel
from src.ancient_engine import AncientEngine
from src.wallet_invader import WalletInvader
from src.utils import send_reown_notification, send_telegram_notification

load_dotenv()

class AlienHunter:
    def __init__(self):
        self.cosmic_intel = CosmicIntel()
        self.ancient_engine = AncientEngine()
        self.wallet_invader = WalletInvader()

    async def scan(self):
        print("Scanning for opportunities...")
        opportunities = await self.cosmic_intel.gather_intel()
        for opp in opportunities:
            print(f"Analyzing opportunity: {opp['title']}")
            score = self.ancient_engine.qualify(opp)
            if score > 0.85:
                print(f"High-value opportunity found: {opp['title']}. Taking action...")
                await self.wallet_invader.execute_wormhole_bridge(opp)
                await send_reown_notification(f"High-value opportunity found: {opp['title']}")
                await send_telegram_notification(f"High-value opportunity found: {opp['title']}")

    async def run_daemon(self):
        while True:
            await self.scan()
            await asyncio.sleep(3600)  # Run every hour
