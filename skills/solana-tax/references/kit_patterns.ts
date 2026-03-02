/**
 * kit_patterns.ts — @solana/kit Reference for ClawAi Tax Engine
 *
 * Based on the official Solana Kit upgrade guide:
 * https://www.solanakit.com/docs/upgrade-guide
 *
 * Key philosophy: Kit is fully tree-shakeable. No Connection class.
 * Every import is a named function — only bundle what you use.
 */

import {
  // RPC creation — replaces `new Connection()`
  createSolanaRpc,
  createSolanaRpcSubscriptions,

  // Address — replaces `new PublicKey()`
  address,
  Address,

  // Account fetching
  fetchEncodedAccount,
  fetchEncodedAccounts,
  assertAccountExists,
  decodeAccount,

  // Codecs (serialization — replaces borsh)
  getStructCodec,
  getU8Codec,
  getU32Codec,
  getU64Codec,
  getUtf8Codec,
  getAddressCodec,
  addCodecSizePrefix,
  Codec,

  // Transaction building — replaces `new Transaction()`
  createTransactionMessage,
  appendTransactionMessageInstructions,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  pipe,

  // Signing — replaces `Keypair.generate()`, `transaction.sign()`
  generateKeyPair,
  generateKeyPairSigner,
  createNoopSigner,
  compileTransaction,
  signTransaction,
  signTransactionMessageWithSigners,

  // Sending & confirming
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,

  // Subscriptions (account change listeners)
  RpcSubscriptions,
} from '@solana/kit';

// ─── 1. RPC Setup ─────────────────────────────────────────────────────────────
// Replaces: const connection = new Connection(url)
// Kit: functional, tree-shakeable, no bundled unused methods

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
const rpcSubscriptions = createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com');


// ─── 2. Addresses ────────────────────────────────────────────────────────────
// Replaces: new PublicKey('1234..5678')
// Kit: address() returns a branded string type — catches typos at compile time

const wallet = address('YourWalletAddressHere11111111111111111111111');


// ─── 3. Fetching Account Balance ─────────────────────────────────────────────
// Replaces: connection.getBalance(wallet)
// Kit: rpc.method(args).send() pattern — explicit async control

async function getBalance(walletAddr: Address): Promise<bigint> {
  const { value: balance } = await rpc.getBalance(walletAddr).send();
  return balance; // bigint (lamports) — Kit uses bigint for large numbers
}


// ─── 4. Fetching Signatures for Tax History ──────────────────────────────────
// Core function used by ClawAi tax engine to get transaction history

async function getTaxHistory(walletAddr: Address, limit = 1000) {
  const signatures = await rpc
    .getSignaturesForAddress(walletAddr, { limit })
    .send();

  return signatures; // Array of { signature, blockTime, slot, err, memo }
}


// ─── 5. Fetching Full Transaction Details ────────────────────────────────────
// Used to analyze SOL/token balance changes for tax classification

async function getTransactionDetail(sig: string) {
  const tx = await rpc
    .getTransaction(sig, {
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
    })
    .send();

  return tx;
  // tx.meta.preBalances, tx.meta.postBalances  → SOL delta
  // tx.meta.preTokenBalances, tx.meta.postTokenBalances → SPL token delta
  // tx.meta.logMessages → program logs for DEX/swap detection
}


// ─── 6. Fetching & Decoding Accounts ─────────────────────────────────────────
// Replaces: connection.getAccountInfo(wallet)
// Kit: fetchEncodedAccount returns MaybeAccount with .exists boolean

async function fetchAccount(walletAddr: Address) {
  const account = await fetchEncodedAccount(rpc, walletAddr);

  // assertAccountExists throws if account not found
  assertAccountExists(account);

  // account.data is Uint8Array — decode with a codec
  account.data satisfies Uint8Array;
  return account;
}


// ─── 7. Custom Account Codec ─────────────────────────────────────────────────
// Replaces: manual borsh deserialization
// Kit: composable codecs for any on-chain account structure

type StakeAccount = {
  discriminator: number;
  owner: Address;
  stakedAmount: bigint;
  rewardsEarned: bigint;
};

const stakeAccountCodec: Codec<StakeAccount> = getStructCodec([
  ['discriminator', getU8Codec()],
  ['owner', getAddressCodec()],
  ['stakedAmount', getU64Codec()],
  ['rewardsEarned', getU64Codec()],
]);

async function fetchStakeAccount(accountAddr: Address) {
  const encoded = await fetchEncodedAccount(rpc, accountAddr);
  assertAccountExists(encoded);
  const decoded = decodeAccount(encoded, stakeAccountCodec);
  // decoded.data is now typed as StakeAccount
  return decoded;
}


// ─── 8. Building a Tax-Relevant Transaction ──────────────────────────────────
// Replaces: new Transaction().add(ix)
// Kit: pipe() chaining with explicit type transformations

import { getTransferSolInstruction } from '@solana-program/system';

async function buildTransfer(amount: bigint) {
  const [payer, destination] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transferInstruction = getTransferSolInstruction({
    source: payer,           // TransactionSigner — not just an address
    destination: destination.address,
    amount,
  });

  // pipe() chains immutable transformations → strong TypeScript types at each step
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions([transferInstruction], tx),
  );

  return transactionMessage;
}


// ─── 9. Signing Transactions ─────────────────────────────────────────────────
// Replaces: transaction.sign([payer, authority])
// Kit: signers are embedded in instructions, auto-discovered

async function signAndSend() {
  const txMessage = await buildTransfer(1_000_000_000n); // 1 SOL in lamports (bigint)

  // signTransactionMessageWithSigners auto-extracts all required signers
  // from the transaction message — no need to manually pass them
  const signedTx = await signTransactionMessageWithSigners(txMessage);

  // Signature is known before sending
  const signature = getSignatureFromTransaction(signedTx);

  // Send and confirm
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  await sendAndConfirm(signedTx, { commitment: 'confirmed' });

  return signature;
}


// ─── 10. Real-Time Account Subscriptions ─────────────────────────────────────
// Replaces: connection.onAccountChange(wallet, callback)
// Kit: AbortController-based, async iterator pattern

async function watchWallet(walletAddr: Address) {
  const abortController = new AbortController();

  const notifications = await rpcSubscriptions
    .accountNotifications(walletAddr, { commitment: 'confirmed' })
    .subscribe({ abortSignal: abortController.signal });

  try {
    for await (const accountInfo of notifications) {
      console.log('Account changed:', accountInfo);
      // Use for: real-time tax event detection, balance monitoring
    }
  } catch (e) {
    // Handle subscription disconnect gracefully
    console.log('Subscription ended:', e);
  }

  // Cancel subscription
  // abortController.abort();
}


// ─── 11. Compatibility Layer ─────────────────────────────────────────────────
// For incremental migration from Web3.js — @solana/compat package

import {
  fromLegacyPublicKey,
  fromLegacyKeypair,
  fromLegacyTransactionInstruction,
  fromVersionedTransaction,
} from '@solana/compat';
import { Keypair, PublicKey } from '@solana/web3.js';
import { createSignerFromKeyPair } from '@solana/kit';

async function migrateFromWeb3js() {
  // Convert PublicKey → Address
  const addr = fromLegacyPublicKey(new PublicKey('1234..5678'));

  // Convert Keypair → CryptoKeyPair → Signer
  const cryptoKeyPair = await fromLegacyKeypair(Keypair.generate());
  const signer = await createSignerFromKeyPair(cryptoKeyPair);

  // Convert legacy Transaction → Kit Transaction
  // const kitTx = fromVersionedTransaction(legacyTx);

  return { addr, signer };
}


// ─── Tax Engine Integration Points ───────────────────────────────────────────

export {
  rpc,
  rpcSubscriptions,
  getTaxHistory,
  getTransactionDetail,
  fetchAccount,
  fetchStakeAccount,
  watchWallet,
  migrateFromWeb3js,
};
