# IRS Crypto Tax Rules Reference

Quick reference used by ClawAi Tax Engine to classify events correctly.

## Core Rule: Every Crypto Disposal is a Taxable Event

A **disposal** occurs when you:
- Sell crypto for USD/fiat
- Swap one token for another (e.g., SOL → USDC on Jupiter)
- Use crypto to buy goods/services
- Send crypto as a gift (over $18,000/year per recipient)
- Receive staking rewards, LP fees, airdrops (treated as income at FMV)

## Capital Gains vs. Ordinary Income

| Event                  | Tax Treatment            | Form      |
|------------------------|--------------------------|-----------|
| Token swap             | Capital gain/loss        | 8949      |
| SOL transfer out       | Capital gain/loss        | 8949      |
| NFT sale               | Capital gain/loss        | 8949      |
| Staking rewards        | Ordinary income          | Schedule 1|
| LP/DeFi yield          | Ordinary income          | Schedule 1|
| Airdrop received       | Ordinary income          | Schedule 1|
| Hard fork tokens       | Ordinary income          | Schedule 1|
| Mining rewards         | Self-employment income   | Schedule C|

## Holding Period

- **Short-term**: Held < 365 days → taxed as ordinary income rate (up to 37%)
- **Long-term**: Held ≥ 365 days → taxed at preferred rates (0%, 15%, or 20%)

## Cost Basis Methods

**FIFO (First-In First-Out)**
- IRS default recommendation
- Sell oldest coins first
- Usually produces the highest holding period (more long-term gains)

**LIFO (Last-In First-Out)**  
- Sell newest coins first
- Can reduce short-term gains if prices have dropped recently
- *Note: Not all tax software supports LIFO for crypto*

**HIFO (Highest-In First-Out)**
- Sell highest-cost lots first
- Minimizes total taxable gain
- Requires detailed lot-level record keeping

## Wash Sale Rule (2024 Note)

As of the IRS guidance current to early 2025:
- The wash sale rule (IRC §1091) **does NOT apply to cryptocurrency** 
- You can sell crypto at a loss and immediately rebuy without disallowing the loss
- *Watch for potential legislative changes — Congress has proposed applying wash sale rules to crypto*

## Staking Rewards: Jarrett vs IRS

The Jarrett case (2024) argued staking rewards should not be taxed until sold.
- IRS **still maintains** staking rewards are income when received (Rev. Rul. 2023-14)
- ClawAi default: treats staking rewards as ordinary income at FMV when received
- Conservative approach recommended pending further guidance

## DeFi-Specific Rules

| DeFi Action                  | Tax Treatment                           |
|------------------------------|-----------------------------------------|
| Add liquidity (LP)           | Not taxable (disposition of tokens IS) |
| Remove liquidity             | Taxable disposal of LP tokens           |
| Claim LP fees                | Ordinary income                         |
| Borrow (collateralized loan) | Not taxable                             |
| Liquidation                  | Taxable disposal of collateral          |
| Wrapped tokens (wSOL)        | Taxable swap in most interpretations    |

## NFTs

- Minting an NFT = acquiring an asset (cost basis = minting cost)
- Selling an NFT = capital gain/loss (proceeds - cost basis)
- Royalties received = ordinary income
- Collectibles may be subject to 28% max rate (vs. 20% for other LT gains)

## Record-Keeping Requirements

IRS requires:
1. Date acquired
2. Date disposed
3. Amount (in USD) at acquisition (cost basis)
4. Amount (in USD) at disposal (proceeds)
5. Gain or loss
6. Holding period

ClawAi Tax Engine records all of these automatically per transaction.

## Relevant IRS Publications

- **Notice 2014-21**: Crypto treated as property, not currency
- **Rev. Rul. 2023-14**: Staking rewards are gross income
- **Form 8949**: Sales and Other Dispositions of Capital Assets
- **Schedule D**: Capital Gains and Losses summary
- **Schedule 1**: Additional Income (for staking/airdrops)

---

*This reference is for informational purposes only. Consult a licensed tax professional for your specific situation.*
