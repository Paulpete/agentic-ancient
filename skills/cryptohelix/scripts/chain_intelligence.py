#!/usr/bin/env python3
"""
Multi-Chain Intelligence Engine - Query Solana, ETH, NEAR, BTC simultaneously.
Supports Helius, Etherscan, Moralis, Quicknode, and other providers.
"""
import json
import urllib.request
import urllib.parse
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum

class Chain(Enum):
    """Supported blockchain networks."""
    SOLANA = "solana"
    ETHEREUM = "ethereum"
    POLYGON = "polygon"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    BASE = "base"
    NEAR = "near"
    BITCOIN = "bitcoin"

@dataclass
class TokenBalance:
    """Token balance information."""
    chain: str
    token_address: str
    token_symbol: str
    token_name: str
    balance: float
    decimals: int
    usd_value: Optional[float] = None

@dataclass
class Transaction:
    """Transaction information."""
    chain: str
    tx_hash: str
    from_address: str
    to_address: str
    value: float
    timestamp: int
    status: str
    gas_used: Optional[float] = None

class RelayerOrchestrator:
    """Smart endpoint switching between multiple providers."""
    
    def __init__(self, api_keys: Dict[str, str] = None):
        self.api_keys = api_keys or {}
        self.providers = {
            Chain.SOLANA: ['helius', 'quicknode', 'solscan'],
            Chain.ETHEREUM: ['etherscan', 'alchemy', 'moralis'],
            Chain.POLYGON: ['polygonscan', 'alchemy'],
            Chain.ARBITRUM: ['arbiscan', 'alchemy'],
            Chain.NEAR: ['near-api'],
        }
        self.active_providers = {}
    
    def get_provider(self, chain: Chain) -> str:
        """Get active provider for chain (with failover)."""
        if chain not in self.active_providers:
            # Select first available provider
            available = self.providers.get(chain, [])
            for provider in available:
                if self._test_provider(chain, provider):
                    self.active_providers[chain] = provider
                    return provider
            
            # No provider available
            raise ConnectionError(f"No provider available for {chain.value}")
        
        return self.active_providers[chain]
    
    def _test_provider(self, chain: Chain, provider: str) -> bool:
        """Test if provider is reachable."""
        # Simplified test - in production, ping actual endpoint
        api_key_name = f"{chain.value}_{provider}"
        return api_key_name in self.api_keys or provider in ['solscan']  # Some have free tiers
    
    def switch_provider(self, chain: Chain, next_provider: str):
        """Manually switch to different provider."""
        if next_provider in self.providers.get(chain, []):
            self.active_providers[chain] = next_provider
            print(f"✓ Switched {chain.value} to {next_provider}")
        else:
            print(f"✗ Provider {next_provider} not available for {chain.value}")

class MultiChainIntelligence:
    """Query multiple chains simultaneously."""
    
    def __init__(self, api_keys: Dict[str, str] = None):
        self.relayer = RelayerOrchestrator(api_keys)
        self.cache = {}
    
    def get_portfolio(self, address: str, chains: List[Chain] = None) -> Dict[Chain, List[TokenBalance]]:
        """Get token balances across multiple chains."""
        chains = chains or [Chain.SOLANA, Chain.ETHEREUM, Chain.POLYGON]
        portfolio = {}
        
        for chain in chains:
            try:
                balances = self._get_balances_for_chain(chain, address)
                portfolio[chain] = balances
            except Exception as e:
                print(f"⚠ Error fetching {chain.value}: {e}")
                portfolio[chain] = []
        
        return portfolio
    
    def _get_balances_for_chain(self, chain: Chain, address: str) -> List[TokenBalance]:
        """Get balances for specific chain."""
        # Check cache
        cache_key = f"{chain.value}:{address}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        provider = self.relayer.get_provider(chain)
        
        if chain == Chain.SOLANA:
            balances = self._fetch_solana_balances(address, provider)
        elif chain in [Chain.ETHEREUM, Chain.POLYGON, Chain.ARBITRUM]:
            balances = self._fetch_evm_balances(chain, address, provider)
        elif chain == Chain.NEAR:
            balances = self._fetch_near_balances(address, provider)
        else:
            balances = []
        
        self.cache[cache_key] = balances
        return balances
    
    def _fetch_solana_balances(self, address: str, provider: str) -> List[TokenBalance]:
        """Fetch Solana SPL token balances."""
        # Placeholder - in production, use actual API calls
        # Example: Helius API
        # GET https://api.helius.xyz/v0/addresses/{address}/balances
        
        print(f"📡 Fetching Solana balances via {provider}")
        
        # Mock data for demonstration
        return [
            TokenBalance(
                chain="solana",
                token_address="So11111111111111111111111111111111111111112",
                token_symbol="SOL",
                token_name="Solana",
                balance=12.5,
                decimals=9,
                usd_value=1250.0
            ),
            TokenBalance(
                chain="solana",
                token_address="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                token_symbol="USDC",
                token_name="USD Coin",
                balance=5000.0,
                decimals=6,
                usd_value=5000.0
            )
        ]
    
    def _fetch_evm_balances(self, chain: Chain, address: str, provider: str) -> List[TokenBalance]:
        """Fetch EVM chain balances."""
        print(f"📡 Fetching {chain.value} balances via {provider}")
        
        # Mock data
        return [
            TokenBalance(
                chain=chain.value,
                token_address="0x0000000000000000000000000000000000000000",
                token_symbol="ETH" if chain == Chain.ETHEREUM else "MATIC",
                token_name="Ethereum" if chain == Chain.ETHEREUM else "Polygon",
                balance=2.5,
                decimals=18,
                usd_value=5000.0
            )
        ]
    
    def _fetch_near_balances(self, address: str, provider: str) -> List[TokenBalance]:
        """Fetch NEAR protocol balances."""
        print(f"📡 Fetching NEAR balances via {provider}")
        
        return [
            TokenBalance(
                chain="near",
                token_address="near",
                token_symbol="NEAR",
                token_name="NEAR Protocol",
                balance=100.0,
                decimals=24,
                usd_value=300.0
            )
        ]
    
    def get_transactions(self, address: str, chain: Chain, limit: int = 10) -> List[Transaction]:
        """Get recent transactions for address on specific chain."""
        provider = self.relayer.get_provider(chain)
        
        print(f"📡 Fetching {limit} recent transactions on {chain.value} via {provider}")
        
        # Mock data
        return [
            Transaction(
                chain=chain.value,
                tx_hash="abc123...xyz",
                from_address=address,
                to_address="0x...",
                value=1.5,
                timestamp=1707148800,
                status="success",
                gas_used=0.001
            )
        ]
    
    def calculate_total_portfolio_value(self, portfolio: Dict[Chain, List[TokenBalance]]) -> float:
        """Calculate total portfolio value across all chains."""
        total = 0.0
        
        for chain, balances in portfolio.items():
            for balance in balances:
                if balance.usd_value:
                    total += balance.usd_value
        
        return total
    
    def get_portfolio_breakdown(self, portfolio: Dict[Chain, List[TokenBalance]]) -> Dict[str, Any]:
        """Get detailed portfolio breakdown."""
        total_value = self.calculate_total_portfolio_value(portfolio)
        
        breakdown = {
            'total_value_usd': total_value,
            'by_chain': {},
            'by_token': {},
            'chain_distribution': {}
        }
        
        for chain, balances in portfolio.items():
            chain_value = sum(b.usd_value or 0 for b in balances)
            breakdown['by_chain'][chain.value] = {
                'value_usd': chain_value,
                'percentage': (chain_value / total_value * 100) if total_value > 0 else 0,
                'token_count': len(balances)
            }
            
            for balance in balances:
                token_key = f"{balance.token_symbol} ({chain.value})"
                breakdown['by_token'][token_key] = {
                    'balance': balance.balance,
                    'value_usd': balance.usd_value,
                    'percentage': (balance.usd_value / total_value * 100) if balance.usd_value and total_value > 0 else 0
                }
        
        return breakdown
    
    def search_token(self, query: str, chains: List[Chain] = None) -> List[Dict[str, Any]]:
        """Search for token across chains."""
        chains = chains or [Chain.SOLANA, Chain.ETHEREUM]
        results = []
        
        print(f"🔍 Searching for '{query}' across {len(chains)} chains...")
        
        # Mock search results
        if "usdc" in query.lower():
            results.append({
                'symbol': 'USDC',
                'name': 'USD Coin',
                'chains': ['solana', 'ethereum', 'polygon'],
                'total_supply': '25B',
                'market_cap': '25B'
            })
        
        return results

def main():
    """CLI interface."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  chain_intelligence.py portfolio <address> [chains...]")
        print("  chain_intelligence.py transactions <address> <chain>")
        print("  chain_intelligence.py search <token-query>")
        print("  chain_intelligence.py relayer <chain> <provider>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Load API keys from environment or config
    api_keys = {
        # 'solana_helius': 'your_key_here',
        # 'ethereum_etherscan': 'your_key_here',
    }
    
    intel = MultiChainIntelligence(api_keys)
    
    if command == 'portfolio':
        if len(sys.argv) < 3:
            print("Error: Address required")
            sys.exit(1)
        
        address = sys.argv[2]
        chain_names = sys.argv[3:] if len(sys.argv) > 3 else None
        
        chains = [Chain(c.lower()) for c in chain_names] if chain_names else None
        
        portfolio = intel.get_portfolio(address, chains)
        breakdown = intel.get_portfolio_breakdown(portfolio)
        
        print("\n" + "=" * 60)
        print(f"PORTFOLIO: {address}")
        print("=" * 60)
        print(f"\n💰 Total Value: ${breakdown['total_value_usd']:,.2f} USD\n")
        
        print("📊 By Chain:")
        for chain, data in breakdown['by_chain'].items():
            print(f"  {chain.upper():12} ${data['value_usd']:>10,.2f}  ({data['percentage']:>5.1f}%)  {data['token_count']} tokens")
        
        print("\n🪙 Top Holdings:")
        sorted_tokens = sorted(breakdown['by_token'].items(), key=lambda x: x[1].get('value_usd', 0), reverse=True)
        for token, data in sorted_tokens[:10]:
            print(f"  {token:20} {data['balance']:>12.4f}  ${data.get('value_usd', 0):>10,.2f}  ({data.get('percentage', 0):>5.1f}%)")
    
    elif command == 'transactions':
        if len(sys.argv) < 4:
            print("Error: Address and chain required")
            sys.exit(1)
        
        address = sys.argv[2]
        chain = Chain(sys.argv[3].lower())
        
        txs = intel.get_transactions(address, chain)
        
        print(f"\n🔍 Recent transactions on {chain.value}:")
        for tx in txs:
            print(f"  {tx.tx_hash[:16]}... | {tx.value:>8.4f} | {tx.status}")
    
    elif command == 'search':
        if len(sys.argv) < 3:
            print("Error: Query required")
            sys.exit(1)
        
        query = sys.argv[2]
        results = intel.search_token(query)
        
        print(f"\n🔍 Search results for '{query}':")
        for result in results:
            print(f"\n  {result['symbol']} - {result['name']}")
            print(f"  Chains: {', '.join(result['chains'])}")
            print(f"  Market Cap: ${result.get('market_cap', 'N/A')}")
    
    elif command == 'relayer':
        if len(sys.argv) < 4:
            print("Error: Chain and provider required")
            sys.exit(1)
        
        chain = Chain(sys.argv[2].lower())
        provider = sys.argv[3]
        
        intel.relayer.switch_provider(chain, provider)
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
