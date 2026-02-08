import {
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  PublicKey
} from '@solana/web3.js';
import bs58 from 'bs58';

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const connection = new Connection(HELIUS_RPC);

async function sendOptimizedTransaction(
  fromKeypair: Keypair,
  instructions: any[],
  toPubkey: PublicKey,
  amount: number
) {
  console.log('🚀 HELIUS OPTIMIZED TRANSACTION SENDER');
  console.log('='.repeat(60));
  
  // Step 1: Build initial transaction
  console.log('\n📝 Step 1: Building transaction...');
  const { blockhash } = await connection.getLatestBlockhash();
  
  const messageV0 = new TransactionMessage({
    payerKey: fromKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  
  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([fromKeypair]);
  console.log('✅ Transaction built');
  
  // Step 2: Optimize compute units
  console.log('\n⚡ Step 2: Optimizing compute units...');
  const testInstructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ...instructions,
  ];
  
  const testMessage = new TransactionMessage({
    payerKey: fromKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions: testInstructions,
  }).compileToV0Message();
  
  const testTransaction = new VersionedTransaction(testMessage);
  testTransaction.sign([fromKeypair]);
  
  const { value: simulationResult } = await connection.simulateTransaction(testTransaction);
  
  if (!simulationResult.unitsConsumed) {
    throw new Error('Simulation failed');
  }
  
  const computeUnitLimit = Math.ceil(simulationResult.unitsConsumed * 1.1);
  console.log(`✅ Compute units: ${computeUnitLimit} (${simulationResult.unitsConsumed} + 10% buffer)`);
  
  const setCuLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
    units: computeUnitLimit,
  });
  
  // Step 3: Get priority fee
  console.log('\n💰 Step 3: Getting priority fee...');
  const serializedTransaction = bs58.encode(transaction.serialize());
  
  const response = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'getPriorityFeeEstimate',
      params: [{
        transaction: serializedTransaction,
        options: { recommended: true },
      }],
    }),
  });
  
  const data = await response.json();
  const priorityFeeEstimate = data.result?.priorityFeeEstimate || 1000;
  console.log(`✅ Priority fee: ${priorityFeeEstimate} microLamports`);
  
  const setPriorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFeeEstimate,
  });
  
  // Step 4: Build final transaction
  console.log('\n🔨 Step 4: Building final transaction...');
  const finalInstructions = [
    setCuLimitInstruction,
    setPriorityFeeInstruction,
    ...instructions,
  ];
  
  const { blockhash: latestBlockhash, lastValidBlockHeight } = 
    await connection.getLatestBlockhash();
  
  const finalMessage = new TransactionMessage({
    payerKey: fromKeypair.publicKey,
    recentBlockhash: latestBlockhash,
    instructions: finalInstructions,
  }).compileToV0Message();
  
  const finalTransaction = new VersionedTransaction(finalMessage);
  finalTransaction.sign([fromKeypair]);
  
  // Step 5: Send and confirm
  console.log('\n📡 Step 5: Sending transaction...');
  const signature = await connection.sendTransaction(finalTransaction, {
    skipPreflight: true,
  });
  
  console.log(`✅ Signature: ${signature}`);
  console.log('\n⏳ Confirming...');
  
  let confirmed = false;
  let attempts = 0;
  
  while (!confirmed && attempts < 30) {
    const statuses = await connection.getSignatureStatuses([signature]);
    const status = statuses?.value?.[0];
    
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      console.log('✅ Transaction confirmed!');
      confirmed = true;
      break;
    }
    
    const currentBlockHeight = await connection.getBlockHeight();
    if (currentBlockHeight > lastValidBlockHeight) {
      console.log('❌ Blockhash expired');
      break;
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return { signature, confirmed };
}

async function sendFromMultisigProgram() {
  console.log('🔐 MULTISIG PROGRAM TRANSACTION');
  console.log('='.repeat(60));
  
  // Your multisig authority
  const MULTISIG_AUTHORITY = new PublicKey('CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ');
  
  // Example: Send SOL from multisig
  const recipient = new PublicKey('GL6kwZxTaXUXMGAvmmNZSXxANnwtPmKCHprHBM82zYXp');
  
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: MULTISIG_AUTHORITY,
      toPubkey: recipient,
      lamports: 0.001 * LAMPORTS_PER_SOL,
    }),
  ];
  
  console.log(`From: ${MULTISIG_AUTHORITY.toBase58()}`);
  console.log(`To: ${recipient.toBase58()}`);
  console.log(`Amount: 0.001 SOL`);
  
  // Note: For multisig, you need the actual signer keypair
  // This is a placeholder - replace with your actual signer
  console.log('\n⚠️  Multisig requires 2-of-3 signatures');
  console.log('   Use Squads SDK to create proposal first');
}

// Run
sendFromMultisigProgram().catch(console.error);
