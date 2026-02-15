# EMPIRE INFINITY MATRIX - Setup Instructions

## Prerequisites
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Verify installation
solana --version
```

## Installation
```bash
# Clone repository
git clone https://github.com/Paulpete/agentic-ancient.git
cd agentic-ancient

# Install dependencies
npm install
```

## Configuration
```bash
# Create .env.local file
cat > .env.local << EOF
HELIUS_API_KEY=your_helius_api_key
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key
BICONOMY_API_KEY=your_biconomy_api_key
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
EOF
```

## Run Application
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## Access
Open browser: http://localhost:3000

## Features
- **Ralph Loop** - Autonomous agent execution
- **Scan Programs** - Get all upgradable Solana programs
- **Execute Program** - Call program instructions via CLI
- **Supertransaction** - Biconomy gasless transactions

## Solana CLI Setup
```bash
# Set mainnet-beta as default
solana config set --url mainnet-beta

# Create/import wallet
solana-keygen new
# or
solana-keygen recover

# Check balance
solana balance
```

## Troubleshooting
- Ensure Solana CLI is in PATH
- Check .env.local has valid API keys
- Verify wallet has SOL for transactions
