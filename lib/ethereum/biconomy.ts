/**
 * lib/ethereum/biconomy.ts
 *
 * Biconomy Smart Account v4 integration.
 * Supports Base mainnet, Polygon, Ethereum mainnet.
 *
 * FIX: Removed hardcoded bundler API key (nJPK7B32G...) — now loaded from
 *      BICONOMY_BUNDLER_KEY env var. Removed deprecated Base Goerli testnet.
 */

import { createSmartAccountClient, PaymasterMode } from '@biconomy/account'
import { ethers } from 'ethers'
import { logTaxEvent } from '../tax/engine'

// ─── Agent ETH address ───────────────────────────────────────────────────────
export const AGENT_ETH_ADDRESS = process.env.AGENT_ETH_ADDRESS ?? '0xF66254F21a3e0F0E9C6fF7Ee096d8d1144A0dfCc'

// ─── Chain configs ─────────────────────────────────────────────────────────

export type SupportedChain = 'base' | 'polygon' | 'ethereum'

interface ChainConfig {
  chainId: number
  rpcUrl: string
  bundlerUrl: string
  explorerUrl: string
  name: string
}

// FIX: Bundler API key moved to env var — no secrets in source code
function getBundlerKey(): string {
  const key = process.env.BICONOMY_BUNDLER_KEY
  if (!key) throw new Error('BICONOMY_BUNDLER_KEY not set in environment')
  return key
}

function buildBundlerUrl(chainId: number): string {
  return `https://bundler.biconomy.io/api/v2/${chainId}/${getBundlerKey()}`
}

export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  'base': {
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
    get bundlerUrl() { return buildBundlerUrl(8453) },
    explorerUrl: 'https://basescan.org',
    name: 'Base',
  },
  'polygon': {
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
    get bundlerUrl() { return buildBundlerUrl(137) },
    explorerUrl: 'https://polygonscan.com',
    name: 'Polygon',
  },
  'ethereum': {
    chainId: 1,
    rpcUrl: process.env.ETH_RPC_URL ?? 'https://eth.llamarpc.com',
    get bundlerUrl() { return buildBundlerUrl(1) },
    explorerUrl: 'https://etherscan.io',
    name: 'Ethereum',
  },
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Transaction {
  to: string
  data?: string
  value?: bigint | string | number
}

export interface GaslessResult {
  userOpHash: string
  txHash: string
  smartAccountAddress: string
  chain: SupportedChain
  explorerUrl: string
  success: boolean
}

// ─── BiconomyClient ─────────────────────────────────────────────────────────

export class BiconomyClient {
  private smartAccount: any
  private chain: SupportedChain
  private config: ChainConfig
  private smartAccountAddress: string = ''

  private constructor(chain: SupportedChain) {
    this.chain = chain
    this.config = CHAIN_CONFIGS[chain]
  }

  static async create(chain: SupportedChain = 'base'): Promise<BiconomyClient> {
    if (!process.env.BICONOMY_API_KEY)  throw new Error('BICONOMY_API_KEY not set')
    if (!process.env.ETH_PRIVATE_KEY)   throw new Error('ETH_PRIVATE_KEY not set')
    if (!process.env.BICONOMY_BUNDLER_KEY) throw new Error('BICONOMY_BUNDLER_KEY not set')

    const client = new BiconomyClient(chain)
    await client._init()
    return client
  }

  private async _init() {
    const provider = new ethers.JsonRpcProvider(this.config.rpcUrl)
    const signer   = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider)

    this.smartAccount = await createSmartAccountClient({
      signer,
      chainId:                 this.config.chainId,
      bundlerUrl:              this.config.bundlerUrl,
      biconomyPaymasterApiKey: process.env.BICONOMY_API_KEY!,
      rpcUrl:                  this.config.rpcUrl,
    })

    this.smartAccountAddress = await this.smartAccount.getAccountAddress()
    console.log(`[Biconomy] Smart Account (${this.config.name}): ${this.smartAccountAddress}`)
  }

  getAddress(): string      { return this.smartAccountAddress }
  getChain(): SupportedChain { return this.chain }
  getChainConfig(): ChainConfig { return this.config }

  async sendGasless(tx: Transaction): Promise<GaslessResult> {
    return this.sendBatch([tx])
  }

  async sendBatch(txs: Transaction[]): Promise<GaslessResult> {
    const normalised = txs.map(tx => ({
      to:    tx.to,
      data:  tx.data ?? '0x',
      value: tx.value ? BigInt(tx.value.toString()) : BigInt(0),
    }))

    const userOpResponse = await this.smartAccount.sendTransaction(normalised, {
      paymasterServiceData: { mode: PaymasterMode.SPONSORED },
    })

    console.log(`[Biconomy] UserOp submitted: ${userOpResponse.userOpHash}`)

    const { transactionHash } = await userOpResponse.waitForTxHash()
    const txHash = transactionHash ?? ''

    console.log(`[Biconomy] ✅ Confirmed: ${this.config.explorerUrl}/tx/${txHash}`)

    const totalValueEth = normalised.reduce((sum, t) => sum + Number(t.value) / 1e18, 0)
    if (totalValueEth > 0) {
      logTaxEvent({
        timestamp:     Math.floor(Date.now() / 1000),
        date:          new Date().toISOString().split('T')[0],
        eventType:     'transfer_out',
        asset:         'ETH',
        amount:        totalValueEth,
        costBasisUsd:  0,
        proceedsUsd:   0,
        gainLossUsd:   0,
        holdingDays:   0,
        taxCategory:   'short_term_gain',
        signature:     txHash,
        strategySource:'biconomy',
        notes:         `Gasless UserOp · ${this.config.name} · ${txs.length} tx(s)`,
      })
    }

    return {
      userOpHash:          userOpResponse.userOpHash,
      txHash,
      smartAccountAddress: this.smartAccountAddress,
      chain:               this.chain,
      explorerUrl:         `${this.config.explorerUrl}/tx/${txHash}`,
      success:             true,
    }
  }

  async getUserOpStatus(userOpHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed'
    txHash?: string
  }> {
    try {
      const bundler = this.smartAccount.getBundlerProvider()
      const receipt = await bundler.getUserOperationReceipt(userOpHash)
      if (!receipt) return { status: 'pending' }
      return {
        status: receipt.success ? 'confirmed' : 'failed',
        txHash: receipt.receipt?.transactionHash,
      }
    } catch {
      return { status: 'pending' }
    }
  }
}

// ─── Singleton cache ──────────────────────────────────────────────────────────

const _cache = new Map<SupportedChain, BiconomyClient>()

export async function getBiconomyClient(
  chain: SupportedChain = 'base'
): Promise<BiconomyClient> {
  if (!_cache.has(chain)) {
    _cache.set(chain, await BiconomyClient.create(chain))
  }
  return _cache.get(chain)!
}
