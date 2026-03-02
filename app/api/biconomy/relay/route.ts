/**
 * POST /api/biconomy/relay
 *
 * Server-side gasless transaction relay.
 * The Ralph agent (and any server-side code) calls this to execute
 * EVM transactions via the Biconomy Smart Account without the user
 * needing to sign or pay gas.
 *
 * Body:
 *   transactions: { to, data?, value? }[]   — one or more txs to batch
 *   chain?:       'base' | 'base-goerli' | 'polygon' | 'ethereum'  (default: 'base')
 *
 * Returns:
 *   { userOpHash, txHash, smartAccountAddress, chain, explorerUrl, success }
 */

import { NextResponse } from 'next/server'
import { getBiconomyClient, SupportedChain, CHAIN_CONFIGS } from '@/lib/ethereum/biconomy'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { transactions, chain = 'base' } = body as {
      transactions: { to: string; data?: string; value?: string }[]
      chain?: SupportedChain
    }

    // ── Validation ─────────────────────────────────────────────────────────
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'transactions array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (!CHAIN_CONFIGS[chain]) {
      return NextResponse.json(
        { error: `Unsupported chain "${chain}". Supported: ${Object.keys(CHAIN_CONFIGS).join(', ')}` },
        { status: 400 }
      )
    }

    for (const tx of transactions) {
      if (!tx.to || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) {
        return NextResponse.json(
          { error: `Invalid "to" address: ${tx.to}` },
          { status: 400 }
        )
      }
    }

    // ── Relay via Biconomy Smart Account ────────────────────────────────────
    console.log(`[/api/biconomy/relay] Relaying ${transactions.length} tx(s) on ${chain}`)

    const client = await getBiconomyClient(chain)
    const result = await client.sendBatch(transactions)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('[/api/biconomy/relay] Error:', error)

    // Surface friendly errors for common misconfigs
    if (error.message?.includes('BICONOMY_API_KEY')) {
      return NextResponse.json(
        { error: 'Biconomy not configured. Set BICONOMY_API_KEY in .env.local' },
        { status: 503 }
      )
    }
    if (error.message?.includes('ETH_PRIVATE_KEY')) {
      return NextResponse.json(
        { error: 'ETH signer not configured. Set ETH_PRIVATE_KEY in .env.local' },
        { status: 503 }
      )
    }
    if (error.message?.includes('AA21') || error.message?.includes('insufficient funds')) {
      return NextResponse.json(
        { error: 'Paymaster balance too low. Top up at dashboard.biconomy.io' },
        { status: 402 }
      )
    }

    return NextResponse.json(
      { error: error.message ?? 'Unknown relay error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/biconomy/relay
 * Returns Smart Account address and paymaster balance info per chain.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const chain = (searchParams.get('chain') ?? 'base') as SupportedChain

    if (!CHAIN_CONFIGS[chain]) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 })
    }

    const client    = await getBiconomyClient(chain)
    const config    = client.getChainConfig()

    return NextResponse.json({
      smartAccountAddress: client.getAddress(),
      chain,
      chainId:     config.chainId,
      chainName:   config.name,
      explorerUrl: `${config.explorerUrl}/address/${client.getAddress()}`,
      status:      'ready',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
