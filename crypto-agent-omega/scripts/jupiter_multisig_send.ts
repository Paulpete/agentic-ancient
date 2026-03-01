import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Multisig } from '@sqds/multisig';

/**
 * Jupiter Aggregator v6 with Multisig Authority
 * Program: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
 * Authority: CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ
 */

const JUPITER_PROGRAM = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const MULTISIG_AUTHORITY = new PublicKey('CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ');
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

async function checkMultisigStatus() {
    const connection = new Connection(HELIUS_RPC);
    
    console.log('🔍 Checking Multisig Authority:', MULTISIG_AUTHORITY.toBase58());
    
    const accountInfo = await connection.getAccountInfo(MULTISIG_AUTHORITY);
    
    if (accountInfo) {
        console.log('✅ Multisig exists');
        console.log('   Owner:', accountInfo.owner.toBase58());
        console.log('   Balance:', accountInfo.lamports / 1e9, 'SOL');
        
        // Check if Squads V3
        if (accountInfo.owner.toBase58() === 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu') {
            console.log('   Type: Squads V3 Multisig ✅');
            return true;
        }
    } else {
        console.log('❌ Multisig not found');
    }
    
    return false;
}

async function getJupiterQuote(inputMint: string, outputMint: string, amount: number) {
    console.log('\n💱 Getting Jupiter quote...');
    
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    
    const response = await fetch(url);
    const quote = await response.json();
    
    console.log('✅ Quote received');
    console.log('   Input:', amount / 1e9, 'SOL');
    console.log('   Output:', quote.outAmount / 1e6, 'USDC');
    
    return quote;
}

async function createMultisigProposal(quote: any) {
    console.log('\n📝 Creating multisig proposal...');
    
    const connection = new Connection(HELIUS_RPC);
    
    // Get swap instructions from Jupiter
    const swapUrl = 'https://quote-api.jup.ag/v6/swap-instructions';
    const swapResponse = await fetch(swapUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: MULTISIG_AUTHORITY.toBase58()
        })
    });
    
    const { setupInstructions, swapInstruction, cleanupInstruction } = await swapResponse.json();
    
    console.log('✅ Swap instructions received');
    console.log('   Setup:', setupInstructions?.length || 0);
    console.log('   Swap: 1');
    console.log('   Cleanup:', cleanupInstruction ? 1 : 0);
    
    return {
        setupInstructions,
        swapInstruction,
        cleanupInstruction
    };
}

async function sendWithSquadsMultisig() {
    console.log('\n🔐 Sending through Squads Multisig');
    console.log('=' .repeat(60));
    
    // Check multisig
    const isMultisig = await checkMultisigStatus();
    
    if (!isMultisig) {
        console.log('❌ Not a Squads multisig');
        return;
    }
    
    // Get Jupiter quote (SOL -> USDC)
    const quote = await getJupiterQuote(
        'So11111111111111111111111111111111111111112',  // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',  // USDC
        1000000  // 0.001 SOL
    );
    
    // Get swap instructions
    const instructions = await createMultisigProposal(quote);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Install: npm install @sqds/multisig');
    console.log('2. Create proposal with your signer key');
    console.log('3. Get 2-of-3 approvals from multisig members');
    console.log('4. Execute transaction');
    
    console.log('\n💡 Example code:');
    console.log(`
const multisig = await Multisig.fromAccountAddress(
    connection,
    new PublicKey('${MULTISIG_AUTHORITY.toBase58()}')
);

const proposal = await multisig.createTransaction({
    instructions: [swapInstruction],
    feePayer: yourSigner.publicKey
});

await multisig.approveTransaction(proposal, yourSigner);
// Wait for 2nd approval
await multisig.executeTransaction(proposal);
    `);
}

// Run
sendWithSquadsMultisig().catch(console.error);
