#!/usr/bin/env python3
import os
import requests
from datetime import datetime

class AirdropHunter:
    def __init__(self):
        self.helius_key = os.getenv('HELIUS_API_KEY')
        self.moralis_key = os.getenv('MORALIS_API_KEY')
        
    def track_protocol_interactions(self, wallet: str):
        """Track wallet interactions for airdrop eligibility"""
        url = f"https://api.helius.xyz/v0/addresses/{wallet}/transactions"
        params = {"api-key": self.helius_key, "limit": 100}
        resp = requests.get(url, params=params)
        
        protocols = {}
        for tx in resp.json():
            if 'description' in tx:
                protocol = tx.get('source', 'unknown')
                protocols[protocol] = protocols.get(protocol, 0) + 1
        
        return protocols
    
    def analyze_eligibility(self, wallet: str):
        """Analyze airdrop eligibility patterns"""
        interactions = self.track_protocol_interactions(wallet)
        
        # Known airdrop patterns
        targets = {
            'Jupiter': 10,
            'Drift': 5,
            'MarginFi': 5,
            'Kamino': 5,
            'Tensor': 3
        }
        
        eligible = []
        for protocol, threshold in targets.items():
            count = interactions.get(protocol, 0)
            if count >= threshold:
                eligible.append(f"{protocol}: {count} txs ✅")
            else:
                eligible.append(f"{protocol}: {count}/{threshold} txs")
        
        return eligible
    
    def optimize_interactions(self, wallet: str):
        """Generate optimal interaction strategy"""
        eligibility = self.analyze_eligibility(wallet)
        print(f"🎯 Airdrop Eligibility for {wallet[:8]}...")
        for status in eligibility:
            print(f"  {status}")

if __name__ == "__main__":
    hunter = AirdropHunter()
    hunter.optimize_interactions("4eJZV...")
