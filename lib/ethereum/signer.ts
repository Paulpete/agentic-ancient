/**
 * lib/ethereum/signer.ts
 *
 * Server-side ETH signer for non-gasless EVM operations.
 * Used when Ralph needs to sign raw EVM transactions directly
 * (e.g. calling a contract method that isn't eligible for Biconomy sponsorship).
 *
 * For gasless transactions, use getBiconomyClient() from biconomy.ts instead.
 */

import { ethers } from 'ethers'
import { SupportedChain, CHAIN_CONFIGS } from './biconomy'

let _signerCache: Map<SupportedChain, ethers.Wallet> | null = null

export function getSigner(chain: SupportedChain = 'base'): ethers.Wallet {
  if (!process.env.ETH_PRIVATE_KEY) {
    throw new Error('ETH_PRIVATE_KEY not set in environment variables')
  }

  if (!_signerCache) _signerCache = new Map()

  if (!_signerCache.has(chain)) {
    const config   = CHAIN_CONFIGS[chain]
    const provider = new ethers.JsonRpcProvider(config.rpcUrl)
    const wallet   = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider)
    _signerCache.set(chain, wallet)
  }

  return _signerCache.get(chain)!
}

export async function getSignerAddress(chain: SupportedChain = 'base'): Promise<string> {
  return getSigner(chain).address
}

/**
 * Sign an arbitrary message (e.g. for off-chain auth, EIP-712, etc.)
 */
export async function signMessage(message: string, chain: SupportedChain = 'base'): Promise<string> {
  const signer = getSigner(chain)
  return signer.signMessage(message)
}

/**
 * Send a raw EVM transaction (non-gasless).
 * The signer's EOA pays gas directly.
 */
export async function sendRawTransaction(
  to: string,
  data: string,
  value: bigint = BigInt(0),
  chain: SupportedChain = 'base'
): Promise<{ txHash: string; explorerUrl: string }> {
  const signer = getSigner(chain)
  const config = CHAIN_CONFIGS[chain]

  const tx = await signer.sendTransaction({ to, data, value })
  await tx.wait()

  return {
    txHash:      tx.hash,
    explorerUrl: `${config.explorerUrl}/tx/${tx.hash}`,
  }
}
