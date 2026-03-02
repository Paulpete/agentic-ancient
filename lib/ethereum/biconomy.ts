/**
 * lib/ethereum/biconomy.ts
 *
 * Complete Biconomy Smart Account v4 integration.
 * Supports Base mainnet, Base Goerli, Polygon, Ethereum mainnet.
 *
 * Fixes over the original file:
 *  - Async factory pattern (no fire-and-forget constructor race condition)
 *  - Multi-chain configs (Base mainnet, Base Goerli, Polygon, Ethereum)
 *  - SPONSORED paymaster mode — Biconomy covers gas
 *  - Batch transaction support (multiple actions in one UserOp)
 *  - UserOp status polling
 *  - Tax event emission after each gasless tx (wired to lib/tax/engine)
 */

import { createSmartAccountClient, PaymasterMode } from '@biconomy/account'
import { ethers } from 'ethers'
import { logTaxEvent } from '../tax/engine'

// ─── Chain configs ─────────────────────────────────────────────────────────

export type SupportedChain = 'base' | 'base-goerli' | 'polygon' | 'ethereum'

interface ChainConfig {
  chainId: number
  rpcUrl: string
  bundlerUrl: string
  explorerUrl: string
  name: string
}

const API_KEY = process.env.BICONOMY_API_KEY ?? ''

export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  'base': {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    bundlerUrl: 'https://bundler.biconomy.io/api/v2/8453/nJPK7B32G.7f948574-142f-456a-af40-53d35667b369',
    explorerUrl: 'https://basescan.org',
    name: 'Base',
  },
  'base-goerli': {
    chainId: 84531,
    rpcUrl: 'https://goerli.base.org',
    bundlerUrl: 'https://bundler.biconomy.io/api/v2/84531/nJPK7B32G.7f948574-142f-456a-af40-53d35667b369',
    explorerUrl: 'https://goerli.basescan.org',
    name: 'Base Goerli',
  },
  'polygon': {
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    bundlerUrl: 'https://bundler.biconomy.io/api/v2/137/nJPK7B32G.7f948574-142f-456a-af40-53d35667b369',
    explorerUrl: 'https://polygonscan.com',
    name: 'Polygon',
  },
  'ethereum': {
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    bundlerUrl: 'https://bundler.biconomy.io/api/v2/1/nJPK7B32G.7f948574-142f-456a-af40-53d35667b369',
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

  /**
   * Always use BiconomyClient.create() — async factory prevents
   * the race condition where the old constructor called async setupBiconomy()
   * without awaiting, causing smartAccount to be undefined on first use.
   */
  static async create(chain: SupportedChain = 'base'): Promise<BiconomyClient> {
    if (!process.env.BICONOMY_API_KEY) throw new Error('BICONOMY_API_KEY not set')
    if (!process.env.ETH_PRIVATE_KEY)  throw new Error('ETH_PRIVATE_KEY not set')

    const client = new BiconomyClient(chain)
    await client._init()
    return client
  }

  private async _init() {
    const provider = new ethers.JsonRpcProvider(this.config.rpcUrl)
    const signer   = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider)

    this.smartAccount = await createSmartAccountClient({
      signer,
      chainId:               this.config.chainId,
      bundlerUrl:            this.config.bundlerUrl,
      biconomyPaymasterApiKey: process.env.BICONOMY_API_KEY!,
      rpcUrl:                this.config.rpcUrl,
    })

    this.smartAccountAddress = await this.smartAccount.getAccountAddress()
    console.log(`[Biconomy] Smart Account (${this.config.name}): ${this.smartAccountAddress}`)
  }

  getAddress(): string { return this.smartAccountAddress }
  getChain():   SupportedChain { return this.chain }
  getChainConfig(): ChainConfig { return this.config }

  /**
   * Send one gasless transaction. Biconomy Paymaster covers the gas fee.
   */
  async sendGasless(tx: Transaction): Promise<GaslessResult> {
    return this.sendBatch([tx])
  }

  /**
   * Send multiple transactions as a single atomic UserOperation.
   * All execute in one bundle — one gas payment, multiple actions.
   * Ideal for: approve + swap, multi-transfer, NFT mint + list.
   */
  async sendBatch(txs: Transaction[]): Promise<GaslessResult> {
    const normalised = txs.map(tx => ({
      to:    tx.to,
      data:  tx.data ?? '0x',
      value: tx.value ? BigInt(tx.value.toString()) : BigInt(0),
    }))

    // SPONSORED mode = Biconomy pays gas on behalf of user.
    // Switch to PaymasterMode.ERC20 to pay gas in a stablecoin instead.
    const userOpResponse = await this.smartAccount.sendTransaction(normalised, {
      paymasterServiceData: { mode: PaymasterMode.SPONSORED },
    })

    console.log(`[Biconomy] UserOp submitted: ${userOpResponse.userOpHash}`)

    const { transactionHash } = await userOpResponse.waitForTxHash()
    const txHash = transactionHash ?? ''

    console.log(`[Biconomy] ✅ Confirmed: ${this.config.explorerUrl}/tx/${txHash}`)

    // ── Tax event: log EVM transfers for tax reporting ────────────────────
    const totalValueEth = normalised.reduce(
      (sum, t) => sum + Number(t.value) / 1e18, 0
    )
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
      userOpHash:           userOpResponse.userOpHash,
      txHash,
      smartAccountAddress:  this.smartAccountAddress,
      chain:                this.chain,
      explorerUrl:          `${this.config.explorerUrl}/tx/${txHash}`,
      success:              true,
    }
  }

  /**
   * Poll the bundler for UserOp receipt.
   */
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

// ─── Singleton cache (one per chain, lazy init) ──────────────────────────────

const _cache = new Map<SupportedChain, BiconomyClient>()

export async function getBiconomyClient(
  chain: SupportedChain = 'base'
): Promise<BiconomyClient> {
  if (!_cache.has(chain)) {
    _cache.set(chain, await BiconomyClient.create(chain))
  }
  return _cache.get(chain)!
}
