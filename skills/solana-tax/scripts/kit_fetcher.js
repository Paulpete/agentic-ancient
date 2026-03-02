#!/usr/bin/env node
/**
 * kit_fetcher.js — @solana/kit transaction fetcher for ClawAi Tax Engine
 *
 * Uses Web3.js v2 / @solana/kit patterns from the upgrade guide:
 *   - createSolanaRpc (replaces Connection class — tree-shakeable)
 *   - No Connection class, just functional imports
 *   - address() for type-safe Solana addresses
 *   - .send() to execute RPC calls
 *
 * Usage:
 *   node kit_fetcher.js signatures <wallet> <limit> <rpcUrl>
 *   node kit_fetcher.js transaction <signature> <rpcUrl>
 *   node kit_fetcher.js account <address> <rpcUrl>
 */

// ─── Dependency check ────────────────────────────────────────────────────────
let kitAvailable = false;
let createSolanaRpc, address;

try {
  // Try @solana/kit (Web3.js v2 — new name)
  const kit = require('@solana/kit');
  createSolanaRpc = kit.createSolanaRpc;
  address = kit.address;
  kitAvailable = true;
} catch {
  try {
    // Fallback: @solana/web3.js v2 package name
    const kit = require('@solana/web3.js');
    createSolanaRpc = kit.createSolanaRpc;
    address = kit.address;
    if (createSolanaRpc) kitAvailable = true;
  } catch {
    // Will use built-in https fallback below
  }
}

const https = require('https');
const http  = require('http');

// ─── @solana/kit RPC Wrapper ──────────────────────────────────────────────────

/**
 * Creates an RPC proxy using @solana/kit.
 * From the upgrade guide:
 *   const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
 *   const { value: balance } = await rpc.getBalance(wallet).send();
 */
function createRpc(rpcUrl) {
  if (kitAvailable) {
    return createSolanaRpc(rpcUrl);
  }
  // Fallback: raw JSON-RPC wrapper with same interface
  return createFallbackRpc(rpcUrl);
}

/**
 * Fallback RPC that mimics @solana/kit's Proxy pattern.
 * Returns objects with .send() just like the real Kit Rpc object.
 */
function createFallbackRpc(rpcUrl) {
  function rpcCall(method, params) {
    return {
      send: () => jsonRpc(rpcUrl, method, params)
    };
  }

  // Mirror @solana/kit's Proxy-based API surface
  return new Proxy({}, {
    get(_, method) {
      return (...args) => rpcCall(method, args);
    }
  });
}

// ─── Raw JSON-RPC (fallback) ─────────────────────────────────────────────────

function jsonRpc(rpcUrl, method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const url  = new URL(rpcUrl);
    const lib  = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Kit-style Address Helper ─────────────────────────────────────────────────

/**
 * From the upgrade guide:
 *   import { address } from '@solana/kit';
 *   const wallet = address('1234..5678');
 *
 * The address() function returns a branded string type in TypeScript.
 * In JS we just return the string (same runtime behavior).
 */
function kitAddress(addr) {
  if (kitAvailable && address) {
    try { return address(addr); } catch { return addr; }
  }
  return addr;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Get all signatures for a wallet address.
 *
 * Kit pattern (from upgrade guide):
 *   const rpc = createSolanaRpc(endpoint);
 *   const sigs = await rpc.getSignaturesForAddress(wallet, { limit }).send();
 */
async function getSignatures(wallet, limit, rpcUrl) {
  const rpc = createRpc(rpcUrl);
  const walletAddr = kitAddress(wallet);

  let allSigs = [];
  let before = undefined;
  const batchSize = Math.min(limit, 1000);

  while (allSigs.length < limit) {
    const params = [walletAddr, { limit: Math.min(batchSize, limit - allSigs.length) }];
    if (before) params[1].before = before;

    // Kit-style: rpc.method(args).send()
    let result;
    if (kitAvailable) {
      result = await rpc.getSignaturesForAddress(walletAddr, params[1]).send();
      // Kit returns { value: [...] } for some methods
      if (result && result.value) result = result.value;
    } else {
      result = await jsonRpc(rpcUrl, 'getSignaturesForAddress', params);
    }

    if (!result || result.length === 0) break;

    allSigs = allSigs.concat(result);
    before = result[result.length - 1].signature;

    if (result.length < batchSize) break; // No more pages
  }

  return allSigs.slice(0, limit);
}

/**
 * Get full transaction details by signature.
 *
 * Kit pattern:
 *   const tx = await rpc.getTransaction(sig, { maxSupportedTransactionVersion: 0 }).send();
 */
async function getTransaction(signature, rpcUrl) {
  const rpc = createRpc(rpcUrl);
  const config = { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 };

  if (kitAvailable) {
    try {
      const result = await rpc.getTransaction(signature, config).send();
      // Kit returns { value: tx } 
      return result && result.value !== undefined ? result.value : result;
    } catch (e) {
      // Fallback
    }
  }

  return jsonRpc(rpcUrl, 'getTransaction', [signature, config]);
}

/**
 * Fetch encoded account data.
 *
 * Kit pattern (from upgrade guide):
 *   import { fetchEncodedAccount, assertAccountExists } from '@solana/kit';
 *   const account = await fetchEncodedAccount(rpc, wallet);
 */
async function getAccount(addr, rpcUrl) {
  const rpc = createRpc(rpcUrl);
  const walletAddr = kitAddress(addr);

  if (kitAvailable) {
    try {
      // Try using fetchEncodedAccount if available
      const { fetchEncodedAccount } = require('@solana/kit');
      return await fetchEncodedAccount(rpc, walletAddr);
    } catch {
      // Fall through to getAccountInfo
    }
  }

  const config = { encoding: 'jsonParsed', commitment: 'confirmed' };

  if (kitAvailable) {
    try {
      const result = await rpc.getAccountInfo(walletAddr, config).send();
      return result && result.value !== undefined ? result.value : result;
    } catch {}
  }

  return jsonRpc(rpcUrl, 'getAccountInfo', [addr, config]);
}

/**
 * Get token accounts for a wallet.
 * Useful for tracking all SPL token holdings.
 */
async function getTokenAccounts(wallet, rpcUrl) {
  const config = {
    encoding: 'jsonParsed',
    filters: [{ dataSize: 165 }]
  };

  return jsonRpc(rpcUrl, 'getTokenAccountsByOwner', [
    wallet,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' }
  ]);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const [,, command, arg1, arg2, arg3] = process.argv;

  if (!command) {
    console.error('Usage: kit_fetcher.js <signatures|transaction|account> <arg> [limit] [rpcUrl]');
    process.exit(1);
  }

  const rpcUrl = arg3 || arg2 || 'https://api.mainnet-beta.solana.com';

  try {
    let result;

    switch (command) {
      case 'signatures': {
        const wallet = arg1;
        const limit  = parseInt(arg2, 10) || 1000;
        result = await getSignatures(wallet, limit, rpcUrl);
        break;
      }

      case 'transaction': {
        const sig = arg1;
        result = await getTransaction(sig, rpcUrl);
        break;
      }

      case 'account': {
        const addr = arg1;
        result = await getAccount(addr, rpcUrl);
        break;
      }

      case 'tokens': {
        const wallet = arg1;
        result = await getTokenAccounts(wallet, rpcUrl);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

main();

// ─── Module exports (for use as library) ─────────────────────────────────────
module.exports = { getSignatures, getTransaction, getAccount, getTokenAccounts, createRpc, kitAddress };
