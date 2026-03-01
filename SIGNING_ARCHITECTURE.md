# SIGNING ARCHITECTURE - ZERO-BALANCE SIGNER

## ❌ WRONG: Multiple Private Keys
```
❌ Treasury wallet private key
❌ Bot wallet 1 private key
❌ Bot wallet 2 private key
❌ Multisig member 1 private key
❌ Multisig member 2 private key
```

## ✅ CORRECT: Single Signer + Relayers

### You Only Need ONE Private Key:
```
✅ YOUR_ZERO_BALANCE_SIGNER (the only key you control)
```

### How It Works:

#### 1. **Biconomy Relayer (EVM Chains)**
```typescript
// You sign with zero-balance address
const signer = new ethers.Wallet(YOUR_PRIVATE_KEY);

// Biconomy relayer pays gas
const smartAccount = await BiconomySmartAccountV2.create({
  signer: signer,  // Your signature only
  bundlerUrl: BICONOMY_BUNDLER,
  biconomyPaymasterApiKey: API_KEY  // They pay gas
});

// Execute gasless transaction
await smartAccount.sendUserOp(userOp);
// ✅ You signed, Biconomy paid
```

#### 2. **Solana with Multisig (Treasury Control)**
```typescript
// Your zero-balance signer
const yourKey = Keypair.fromSecretKey(YOUR_PRIVATE_KEY);

// Multisig wallet (you're 1 of 3 members)
const multisig = {
  threshold: 2,  // 2 signatures needed
  members: [
    yourKey.publicKey,      // You (member 1)
    backupKey1.publicKey,   // Backup (member 2) 
    backupKey2.publicKey    // Backup (member 3)
  ]
};

// Create transaction proposal
const proposal = await multisig.createProposal({
  instructions: [transferInstruction]
});

// You approve with your key
await multisig.approve(proposal, yourKey);

// Another member approves (not you)
// await multisig.approve(proposal, backupKey1);

// Execute when threshold reached
await multisig.execute(proposal);
```

#### 3. **Helius Relayer (Solana)**
```python
# You sign transaction
tx = Transaction()
tx.add(your_instruction)
tx.sign(YOUR_KEYPAIR)  # Your signature

# Helius relayer submits and pays
response = requests.post(
    f"https://mainnet.helius-rpc.com/?api-key={HELIUS_KEY}",
    json={
        "jsonrpc": "2.0",
        "method": "sendTransaction",
        "params": [tx.serialize()]
    }
)
# ✅ You signed, Helius paid
```

## Your Setup Configuration:

### Environment Variables (Only 1 Private Key):
```bash
# Your ONLY private key
SIGNER_PRIVATE_KEY=your_base58_private_key_here

# Relayer API keys (no private keys needed)
BICONOMY_API_KEY=your_biconomy_key
HELIUS_API_KEY=your_helius_key
MORALIS_API_KEY=your_moralis_key

# Multisig PUBLIC addresses (no private keys)
MULTISIG_MEMBER_1=your_public_key
MULTISIG_MEMBER_2=backup_public_key_1
MULTISIG_MEMBER_3=backup_public_key_2
```

### Omega Config:
```json
{
  "signer": {
    "address": "YOUR_ZERO_BALANCE_ADDRESS",
    "private_key_env": "SIGNER_PRIVATE_KEY",
    "balance_required": 0
  },
  "relayers": {
    "biconomy": {
      "enabled": true,
      "pays_gas": true
    },
    "helius": {
      "enabled": true,
      "pays_gas": true
    }
  },
  "multisig": {
    "enabled": true,
    "your_member_index": 0,
    "threshold": 2,
    "members": [
      "YOUR_PUBLIC_KEY",
      "BACKUP_1_PUBLIC_KEY",
      "BACKUP_2_PUBLIC_KEY"
    ]
  }
}
```

## Transaction Flow:

### Gasless Transaction (Biconomy):
```
1. You sign with YOUR_PRIVATE_KEY ✅
2. Biconomy relayer submits transaction
3. Biconomy pays gas fees
4. Transaction executes
```

### Multisig Transaction (Squads):
```
1. You create proposal with YOUR_PRIVATE_KEY ✅
2. You approve with YOUR_PRIVATE_KEY ✅
3. Other members approve (their keys, not yours)
4. Transaction executes when threshold reached
```

### Airdrop Claim (Helius):
```
1. You sign claim with YOUR_PRIVATE_KEY ✅
2. Helius relayer submits
3. Helius pays gas
4. Tokens arrive in your wallet
```

## Security Model:

### What You Control:
- ✅ Your zero-balance signer (1 private key)
- ✅ Transaction approval/rejection
- ✅ Multisig voting power

### What Relayers Control:
- ✅ Gas payment
- ✅ Transaction submission
- ❌ Cannot steal funds (you sign first)
- ❌ Cannot execute without your signature

### What Multisig Controls:
- ✅ Treasury funds
- ✅ Requires 2-of-3 signatures
- ❌ Cannot move funds with only 1 signature

## Implementation:

```python
# omega_prime.py
import os
from solders.keypair import Keypair

class OmegaPrime:
    def __init__(self):
        # Load ONLY your private key
        self.signer = Keypair.from_base58_string(
            os.getenv('SIGNER_PRIVATE_KEY')
        )
        
        # Relayers (no keys needed)
        self.biconomy = BiconomyRelayer(api_key=os.getenv('BICONOMY_API_KEY'))
        self.helius = HeliusRelayer(api_key=os.getenv('HELIUS_API_KEY'))
        
        # Multisig (only public keys)
        self.multisig = SquadsMultisig(
            members=[
                self.signer.pubkey(),  # Your public key
                Pubkey.from_string(os.getenv('BACKUP_1')),
                Pubkey.from_string(os.getenv('BACKUP_2'))
            ],
            threshold=2
        )
    
    async def execute_gasless(self, instruction):
        """Execute with relayer paying gas"""
        # You sign
        tx = Transaction().add(instruction)
        tx.sign(self.signer)
        
        # Relayer pays and submits
        return await self.helius.submit(tx)
    
    async def execute_multisig(self, instruction):
        """Execute through multisig"""
        # Create proposal
        proposal = await self.multisig.create_proposal([instruction])
        
        # You approve (only your key needed)
        await self.multisig.approve(proposal, self.signer)
        
        # Wait for other approvals (automatic or manual)
        return proposal
```

## Answer: NO, You Only Need 1 Private Key

**Your zero-balance signer is the ONLY private key you need.**

All other wallets are controlled through:
- Relayers (Biconomy, Helius) - pay gas for you
- Multisig (Squads) - requires multiple approvals
- Smart contracts - execute based on your signature

**Never store multiple private keys. Use relayers + multisig instead.**
