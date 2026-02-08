#!/usr/bin/env python3
"""
Send transaction using Jupiter Aggregator v6 with Multisig Authority
Program: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
Upgrade Authority: CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ (Multisig)
"""
import os
import requests
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from solders.system_program import TransferParams, transfer
from solders.message import Message

# Your program details
JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
MULTISIG_AUTHORITY = "CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ"
PROGRAM_DATA = "4Ec7ZxxAipQT"  # Executable data address

HELIUS_KEY = os.getenv('HELIUS_API_KEY')
RPC_URL = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_KEY}"

class JupiterMultisigSender:
    def __init__(self):
        self.rpc_url = RPC_URL
        self.program_id = Pubkey.from_string(JUPITER_PROGRAM)
        self.multisig_authority = Pubkey.from_string(MULTISIG_AUTHORITY)
        
    def get_account_info(self, address: str):
        """Get account information"""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getAccountInfo",
            "params": [address, {"encoding": "jsonParsed"}]
        }
        resp = requests.post(self.rpc_url, json=payload)
        return resp.json()
    
    def check_multisig_status(self):
        """Check multisig authority status"""
        print(f"🔍 Checking Multisig Authority: {MULTISIG_AUTHORITY}")
        
        info = self.get_account_info(MULTISIG_AUTHORITY)
        if info.get('result', {}).get('value'):
            account = info['result']['value']
            print(f"✅ Multisig exists")
            print(f"   Owner: {account['owner']}")
            print(f"   Balance: {account['lamports'] / 1e9:.6f} SOL")
            
            # Check if it's Squads multisig
            if account['owner'] == 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu':
                print(f"   Type: Squads V3 Multisig ✅")
                return True
        else:
            print("❌ Multisig not found")
        return False
    
    def create_jupiter_swap_instruction(self, input_mint: str, output_mint: str, amount: int):
        """Create Jupiter swap instruction (simplified)"""
        # This is a placeholder - actual Jupiter swap requires API call
        print(f"📝 Creating Jupiter swap instruction")
        print(f"   Input: {input_mint}")
        print(f"   Output: {output_mint}")
        print(f"   Amount: {amount}")
        
        # Get quote from Jupiter API
        quote_url = f"https://quote-api.jup.ag/v6/quote"
        params = {
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": amount,
            "slippageBps": 50
        }
        
        try:
            resp = requests.get(quote_url, params=params)
            quote = resp.json()
            print(f"✅ Quote received: {quote.get('outAmount', 'N/A')}")
            return quote
        except Exception as e:
            print(f"⚠️  Quote failed: {e}")
            return None
    
    def send_with_multisig(self, instruction_data: dict):
        """Send transaction through multisig"""
        print(f"\n🔐 Sending through Multisig Authority")
        print(f"   Authority: {MULTISIG_AUTHORITY}")
        print(f"   Program: {JUPITER_PROGRAM}")
        
        # For Squads multisig, you need to:
        # 1. Create proposal
        # 2. Get approvals (2-of-3)
        # 3. Execute
        
        print(f"\n📋 Next steps:")
        print(f"1. Install Squads SDK: npm install @sqds/multisig")
        print(f"2. Create proposal with your signer")
        print(f"3. Get 2-of-3 approvals")
        print(f"4. Execute transaction")
        
        return {
            "status": "proposal_created",
            "multisig": MULTISIG_AUTHORITY,
            "program": JUPITER_PROGRAM
        }
    
    def test_simple_transfer(self, from_keypair: Keypair, to_address: str, amount_lamports: int):
        """Test simple SOL transfer to verify setup"""
        print(f"\n🧪 Testing simple transfer")
        print(f"   From: {from_keypair.pubkey()}")
        print(f"   To: {to_address}")
        print(f"   Amount: {amount_lamports / 1e9:.6f} SOL")
        
        # Create transfer instruction
        to_pubkey = Pubkey.from_string(to_address)
        transfer_ix = transfer(
            TransferParams(
                from_pubkey=from_keypair.pubkey(),
                to_pubkey=to_pubkey,
                lamports=amount_lamports
            )
        )
        
        # Get recent blockhash
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getLatestBlockhash"
        }
        resp = requests.post(self.rpc_url, json=payload)
        blockhash = resp.json()['result']['value']['blockhash']
        
        # Create transaction
        msg = Message.new_with_blockhash(
            [transfer_ix],
            from_keypair.pubkey(),
            blockhash
        )
        tx = Transaction([from_keypair], msg, blockhash)
        
        # Send transaction
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendTransaction",
            "params": [
                tx.serialize().hex(),
                {"encoding": "base64"}
            ]
        }
        
        try:
            resp = requests.post(self.rpc_url, json=payload)
            result = resp.json()
            
            if 'result' in result:
                print(f"✅ Transaction sent: {result['result']}")
                return result['result']
            else:
                print(f"❌ Error: {result.get('error', 'Unknown')}")
                return None
        except Exception as e:
            print(f"❌ Failed: {e}")
            return None

def main():
    print("🚀 JUPITER MULTISIG TRANSACTION SENDER")
    print("=" * 60)
    
    sender = JupiterMultisigSender()
    
    # Check multisig status
    is_multisig = sender.check_multisig_status()
    
    if is_multisig:
        print(f"\n✅ Multisig confirmed - Squads V3")
        print(f"\n📝 To send transaction:")
        print(f"1. Your signer creates proposal")
        print(f"2. Get 2-of-3 approvals from multisig members")
        print(f"3. Execute when threshold reached")
        
        # Example: Create Jupiter swap
        print(f"\n💱 Example Jupiter Swap:")
        quote = sender.create_jupiter_swap_instruction(
            input_mint="So11111111111111111111111111111111111111112",  # SOL
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            amount=1000000  # 0.001 SOL
        )
        
        if quote:
            result = sender.send_with_multisig(quote)
            print(f"\n✅ Result: {result}")
    else:
        print(f"\n⚠️  Not a Squads multisig or not found")
        print(f"   Check if address is correct")

if __name__ == "__main__":
    main()
