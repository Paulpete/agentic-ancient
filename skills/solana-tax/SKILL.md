---
name: solana-tax
description: Autonomous Solana tax engine for ClawAi. Uses @solana/kit (Web3.js v2) to fetch on-chain data and compute capital gains, income, DeFi yields, and full tax reports. Triggers include "tax", "capital gains", "cost basis", "crypto tax", "DeFi income", "staking rewards", "NFT sales", "P&L", "FIFO", "LIFO", "HIFO", "IRS", "tax report", or any request to compute realized/unrealized gains on Solana wallets.
---

# Solana Tax Engine: ClawAi Autonomous Tax Solver

Fully autonomous tax intelligence for Solana wallets. Fetches raw on-chain transaction history via `@solana/kit`, classifies every event (swap, transfer, stake reward, LP fee, NFT sale), computes cost basis using FIFO/LIFO/HIFO, and generates IRS-ready reports.

## Architecture

```
Wallet Address
     │
     ▼
[Kit RPC Layer]  ←── createSolanaRpc / createSolanaRpcSubscriptions
     │               fetchEncodedAccount, getSignaturesForAddress
     ▼
[Transaction Classifier]
     │  swap | transfer | stake_reward | lp_fee | nft_sale | airdrop
     ▼
[Cost Basis Engine]  ←── FIFO / LIFO / HIFO
     │
     ▼
[Tax Event Calculator]
     │  short_term_gain | long_term_gain | income | loss
     ▼
[Report Generator]  ──► CSV / JSON / XLSX / PDF
```

## Quick Start

### Full Tax Report
```bash
scripts/tax_engine.py report <wallet> --year 2024 --method fifo --rpc https://api.mainnet-beta.solana.com
```

### Capital Gains Only
```bash
scripts/tax_engine.py gains <wallet> --year 2024
```

### Income Events (Staking, Airdrops, LP Fees)
```bash
scripts/tax_engine.py income <wallet> --year 2024
```

### Classify All Transactions
```bash
scripts/tax_engine.py classify <wallet> --limit 500
```

### Export to CSV (TurboTax / TaxAct compatible)
```bash
scripts/tax_engine.py export <wallet> --year 2024 --format turbotax
```

## Supported Tax Events

| Event Type       | Classification     | Notes                        |
|------------------|--------------------|------------------------------|
| Token Swap       | Capital Gain/Loss  | Each swap is a disposal      |
| SOL Transfer Out | Capital Gain/Loss  | Sending = disposal at FMV    |
| Staking Reward   | Ordinary Income    | At FMV when received         |
| LP Fee           | Ordinary Income    | DeFi yield                   |
| Airdrop          | Ordinary Income    | At FMV when received         |
| NFT Sale         | Capital Gain/Loss  | Short/Long term              |
| NFT Mint (buy)   | Cost Basis Event   | Records acquisition price    |
| Wallet Transfer  | Non-taxable        | Same owner, different wallet |

## Cost Basis Methods

- **FIFO** (First-In First-Out) — Default, IRS recommended
- **LIFO** (Last-In First-Out) — Often minimizes short-term gains
- **HIFO** (Highest-In First-Out) — Minimizes total taxable gain

## @solana/kit Integration

This skill uses `@solana/kit` (formerly Web3.js v2). Key patterns:

```typescript
import { address, createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

// Tree-shakeable RPC — no Connection class
const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');

// Fetch signatures
const sigs = await rpc.getSignaturesForAddress(address(wallet), { limit: 1000 }).send();

// Fetch transaction details
const tx = await rpc.getTransaction(sig.signature, { maxSupportedTransactionVersion: 0 }).send();
```

See `references/kit_patterns.ts` for full Kit integration patterns.

## Files

- **scripts/tax_engine.py** — Main autonomous tax engine (CLI + API)
- **scripts/kit_fetcher.js** — @solana/kit transaction fetcher (Node.js)
- **scripts/price_oracle.py** — Historical SOL/token price lookup
- **references/kit_patterns.ts** — Kit v2 code patterns reference
- **references/tax_rules.md** — IRS crypto tax rules reference

## ClawAi Integration

```python
from scripts.tax_engine import SolanaTaxEngine

engine = SolanaTaxEngine(
    rpc_url="https://api.mainnet-beta.solana.com",
    price_api="coingecko"  # or "birdeye", "jupiter"
)

report = engine.generate_report(
    wallet="YourWalletAddress",
    year=2024,
    method="fifo"
)

# Returns structured TaxReport with gains, income, summary
print(f"Total Gains: ${report.total_gains:,.2f}")
print(f"Total Income: ${report.total_income:,.2f}")
print(f"Tax Owed (est.): ${report.estimated_tax:,.2f}")
```

---

**ClawAi solves tax. Empire compounds.** 🧬💰
