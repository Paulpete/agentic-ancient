#!/usr/bin/env python3
import os
import requests
from typing import Dict, List

HELIUS_API_KEY = os.getenv('HELIUS_API_KEY')
HELIUS_RPC = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"

class OmegaScanner:
    def __init__(self):
        self.helius_key = HELIUS_API_KEY
        self.rpc = HELIUS_RPC
        
    def discover_assets_by_owner(self, owner: str) -> List[Dict]:
        url = f"https://mainnet.helius-rpc.com/?api-key={self.helius_key}"
        payload = {
            "jsonrpc": "2.0",
            "id": "omega-scan",
            "method": "getAssetsByOwner",
            "params": {"ownerAddress": owner, "page": 1, "limit": 1000}
        }
        resp = requests.post(url, json=payload)
        return resp.json().get('result', {}).get('items', [])
    
    def get_token_accounts(self, owner: str) -> List[Dict]:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                owner,
                {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
                {"encoding": "jsonParsed"}
            ]
        }
        resp = requests.post(self.rpc, json=payload)
        return resp.json().get('result', {}).get('value', [])
    
    def scan_wallet(self, address: str):
        print(f"🔍 Scanning: {address}")
        assets = self.discover_assets_by_owner(address)
        tokens = self.get_token_accounts(address)
        print(f"✅ Assets: {len(assets)}, Tokens: {len(tokens)}")
        return {"assets": assets, "tokens": tokens}

if __name__ == "__main__":
    scanner = OmegaScanner()
    target = "4eJZV..."  # Replace with actual address
    scanner.scan_wallet(target)
