import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const connection = new Connection(HELIUS_RPC);

// Your Squads V3 Multisig
const MULTISIG_PROGRAM = new PublicKey('SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu');
const MULTISIG_ACCOUNT = new PublicKey('7ZyDFzet6sKgZLN4D89JLfo7chu2n7nYdkFt5RCFk8Sf');

const MEMBERS = [
  new PublicKey('3ZR4gMzciDHZudi5e1evdESKZuCQEE9QNHLkMoRsfDxQ'),
  new PublicKey('89FnbsKH8n6FXCghGUijxh3snqx3e6VXJ7q1fQAHWkQQ'),
  new PublicKey('BYidGfUnfoQtqi4nHiuo57Fjreizbej6hawJLnbwJmYr'),
  new PublicKey('CHRDWWqUs6LyeeoD7pJb3iRfnvYeMfwMUtf2N7zWk7uh'),
  new PublicKey('Dg5NLa5JuwfRMkuwZEguD9RpVrcQD3536GxogUv7pLNV'),
  new PublicKey('EhJqf1p39c8NnH5iuZAJyw778LQua1AhZWxarT5SF8sT'),
  new PublicKey('GGG2JyBtwbPAsYwUQED8GBbj9UMi7NQa3uwN3DmyGNtz'),
];

const THRESHOLD = 4;

async function getMultisigInfo() {
  console.log('🔐 SQUADS V3 MULTISIG INFO');
  console.log('='.repeat(60));
  
  const accountInfo = await connection.getAccountInfo(MULTISIG_ACCOUNT);
  
  if (accountInfo) {
    console.log('✅ Multisig Account Found');
    console.log(`   Address: ${MULTISIG_ACCOUNT.toBase58()}`);
    console.log(`   Program: Squads V3`);
    console.log(`   Balance: ${accountInfo.lamports / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Threshold: ${THRESHOLD} of ${MEMBERS.length}`);
    console.log(`\n👥 Members:`);
    
    MEMBERS.forEach((member, i) => {
      console.log(`   ${i + 1}. ${member.toBase58()}`);
    });
  } else {
    console.log('❌ Multisig not found');
  }
}

async function createTransactionProposal() {
  console.log('\n📝 CREATE TRANSACTION PROPOSAL');
  console.log('='.repeat(60));
  
  // Example: Transfer 0.001 SOL
  const recipient = new PublicKey('GL6kwZxTaXUXMGAvmmNZSXxANnwtPmKCHprHBM82zYXp');
  const amount = 0.001 * LAMPORTS_PER_SOL;
  
  console.log(`From: ${MULTISIG_ACCOUNT.toBase58()}`);
  console.log(`To: ${recipient.toBase58()}`);
  console.log(`Amount: 0.001 SOL`);
  
  console.log('\n📋 Steps to execute:');
  console.log('1. Install Squads SDK:');
  console.log('   npm install @sqds/multisig');
  console.log('');
  console.log('2. Create proposal (any member):');
  console.log(`
import * as multisig from "@sqds/multisig";

const createKey = Keypair.generate();
const [multisigPda] = multisig.getMultisigPda({
  createKey: new PublicKey("${MULTISIG_ACCOUNT.toBase58()}")
});

const instruction = SystemProgram.transfer({
  fromPubkey: multisigPda,
  toPubkey: new PublicKey("${recipient.toBase58()}"),
  lamports: ${amount}
});

const transactionIndex = 1n; // Increment for each new transaction

await multisig.rpc.vaultTransactionCreate({
  connection,
  feePayer: yourKeypair,
  multisigPda,
  transactionIndex,
  creator: yourKeypair.publicKey,
  vaultIndex: 0,
  ephemeralSigners: 0,
  transactionMessage: new TransactionMessage({
    payerKey: multisigPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [instruction]
  })
});
  `);
  
  console.log('3. Approve (need 4 members):');
  console.log(`
await multisig.rpc.proposalApprove({
  connection,
  feePayer: member1Keypair,
  multisigPda,
  transactionIndex,
  member: member1Keypair
});

// Repeat for 3 more members
  `);
  
  console.log('4. Execute (after 4 approvals):');
  console.log(`
await multisig.rpc.vaultTransactionExecute({
  connection,
  feePayer: anyKeypair,
  multisigPda,
  transactionIndex,
  member: anyKeypair.publicKey
});
  `);
}

async function checkMemberBalances() {
  console.log('\n💰 MEMBER BALANCES');
  console.log('='.repeat(60));
  
  for (let i = 0; i < MEMBERS.length; i++) {
    const balance = await connection.getBalance(MEMBERS[i]);
    console.log(`Member ${i + 1}: ${balance / LAMPORTS_PER_SOL} SOL`);
  }
}

async function main() {
  console.log('🌟 SQUADS V3 MULTISIG MANAGER');
  console.log('='.repeat(60));
  console.log(`API Key: ${process.env.HELIUS_API_KEY?.substring(0, 8)}...`);
  console.log('');
  
  await getMultisigInfo();
  await checkMemberBalances();
  await createTransactionProposal();
  
  console.log('\n✅ ANALYSIS COMPLETE');
  console.log('\n💡 Summary:');
  console.log(`   - Multisig: ${MULTISIG_ACCOUNT.toBase58()}`);
  console.log(`   - Threshold: ${THRESHOLD} of ${MEMBERS.length} signatures required`);
  console.log(`   - Your signer must be one of the 7 members`);
  console.log(`   - Need 4 approvals to execute any transaction`);
}

main().catch(console.error);
