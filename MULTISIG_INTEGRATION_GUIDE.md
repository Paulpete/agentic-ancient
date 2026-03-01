# MULTISIG INTEGRATION GUIDE - OMEGA PRIME DEPLOYER

## Analysis of Omega-Prime-Deployer Repository

### Multisig References Found:

#### 1. **Bot Smart Contracts** (`bot-smart-contracts.js`)
- **Contract Deployer Contract** includes `setup_multisig_wallet` function
- Part of expandable bot contract system
- AI Level: 20x intelligence

**Function Purpose:**
```javascript
CONTRACT_DEPLOYER_CONTRACT: {
  name: 'OmegaContractDeployer',
  functions: [
    'deploy_proxy_contract',
    'upgrade_contract_logic',
    'create_governance_token',
    'setup_multisig_wallet',  // <-- MULTISIG SETUP
    'deploy_custom_program'
  ]
}
```

#### 2. **Address Verifier** (`comprehensive-address-verifier.js`)
- Detects Squads V3 multisig program
- Program ID: `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`

**Detection Logic:**
```javascript
// Check if it's a multisig
if (accountInfo.owner.toBase58() === 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu') {
  result.multisig = {
    program: 'Squads V3',
    programId: 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu'
  };
}
```

## How to Use Multisig with Your Setup

### Method 1: Using Squads V3 (Recommended)

**Program ID:** `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`

**Setup Steps:**
1. Install Squads SDK:
```bash
npm install @sqds/multisig
```

2. Create multisig wallet:
```typescript
import { Multisig } from "@sqds/multisig";

const multisig = await Multisig.create({
  connection,
  createKey: creator,
  threshold: 2,  // 2 of 3 signatures required
  members: [
    { key: member1.publicKey, permissions: Permissions.all() },
    { key: member2.publicKey, permissions: Permissions.all() },
    { key: member3.publicKey, permissions: Permissions.all() }
  ]
});
```

3. Execute transactions:
```typescript
const tx = await multisig.createTransaction({
  instructions: [yourInstruction],
  feePayer: payer.publicKey
});

await multisig.approveTransaction(tx);
await multisig.executeTransaction(tx);
```

### Method 2: Using Bot Contract Deployer

**From Omega Prime Deployer:**
```javascript
// Deploy contract with multisig capability
const contractDeployer = {
  name: 'OmegaContractDeployer',
  functions: ['setup_multisig_wallet']
};

// Generate contract PDA
const contractSeed = Buffer.from('OmegaContractDeployer');
const creatorKey = new web3.PublicKey('YOUR_CREATOR_ADDRESS');

const [contractPda] = web3.PublicKey.findProgramAddressSync(
  [contractSeed, creatorKey.toBuffer()],
  TOKEN_PROGRAM_ID
);
```

### Method 3: Integration with Your Agentic Ancient Setup

**Add to `omega_config.json`:**
```json
{
  "multisig": {
    "enabled": true,
    "program": "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu",
    "threshold": 2,
    "members": [
      "MEMBER_1_PUBKEY",
      "MEMBER_2_PUBKEY",
      "MEMBER_3_PUBKEY"
    ],
    "treasury_control": true
  }
}
```

**Create multisig integration:**
```python
# crypto-agent-omega/agent/integrations/multisig.py
from solders.pubkey import Pubkey
from solana.rpc.api import Client

class SquadsMultisig:
    PROGRAM_ID = Pubkey.from_string("SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu")
    
    def __init__(self, connection: Client):
        self.connection = connection
    
    def is_multisig(self, address: str) -> bool:
        """Check if address is a Squads multisig"""
        account = self.connection.get_account_info(Pubkey.from_string(address))
        if account.value:
            return str(account.value.owner) == str(self.PROGRAM_ID)
        return False
    
    def create_proposal(self, multisig_pda: str, instructions: list):
        """Create transaction proposal for multisig approval"""
        # Implementation here
        pass
```

## Recommended Configuration for Your Setup

**Zero-balance signer with multisig relayer:**

```typescript
// Use your zero-balance address as signer
const SIGNER_ADDRESS = "YOUR_ZERO_BALANCE_ADDRESS";

// Multisig controls treasury
const MULTISIG_TREASURY = {
  program: "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu",
  threshold: 2,
  members: [SIGNER_ADDRESS, BACKUP_1, BACKUP_2]
};

// Biconomy relayer pays for transactions
const relayer = new BiconomyRelayer({
  signerAddress: SIGNER_ADDRESS,
  multisigPda: MULTISIG_TREASURY.pda,
  paymaster: true
});
```

## Integration with Omega Prime Orchestrator

**Add to `omega_prime.py`:**
```python
from crypto_agent_omega.agent.integrations.multisig import SquadsMultisig

class OmegaPrime:
    def __init__(self):
        self.multisig = SquadsMultisig(self.connection)
        
    async def execute_with_multisig(self, instruction):
        """Execute transaction through multisig"""
        if self.config['multisig']['enabled']:
            proposal = self.multisig.create_proposal(
                self.config['multisig']['pda'],
                [instruction]
            )
            return await self.multisig.execute(proposal)
```

## Key Findings from Omega-Prime-Deployer:

1. **Squads V3** is the primary multisig solution
2. **Bot contracts** support multisig setup natively
3. **Address verifier** can detect multisig accounts
4. **PDA-based** contract deployment with multisig control

## Next Steps:

1. Install Squads SDK: `npm install @sqds/multisig`
2. Create multisig wallet with your addresses
3. Integrate with Biconomy relayer for gasless txs
4. Add multisig detection to Omega scanner
5. Update workflows to support multisig approvals

## Resources:

- Squads V3 Docs: https://docs.squads.so/
- Program ID: `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`
- Omega Prime Deployer: https://github.com/imfromfuture3000-Android/Omega-prime-deployer
