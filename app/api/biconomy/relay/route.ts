/**
 * POST /api/biconomy/relay
 * Server-side gasless transaction relay.
 *
 * FIX: Added RELAY_API_KEY auth guard — previously any caller could drain the
 *      Biconomy paymaster balance. Set RELAY_API_KEY in .env.local.
 * FIX: Removed deprecated base-goerli chain support.
 */

import { NextResponse } from 'next/server'
import { getBiconomyClient, SupportedChain, CHAIN_CONFIGS } from '@/lib/ethereum/biconomy'

// Simple API key guard for server→server relay calls
function isAuthorized(request: Request): boolean {
  const required = process.env.RELAY_API_KEY
  if (!required) return true // dev mode
  return request.headers.get('x-api-key') === required
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { transactions, chain = 'base' } = body as {
      transactions: { to: string; data?: string; value?: string }[]
      chain?: SupportedChain
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'transactions array is required and must not be empty' },
        { status: 400 }
      )
    }

    // FIX: validate chain against updated CHAIN_CONFIGS (base-goerli removed)
    if (!CHAIN_CONFIGS[chain as SupportedChain]) {
      return NextResponse.json(
        { error: `Unsupported chain "${chain}". Supported: ${Object.keys(CHAIN_CONFIGS).join(', ')}` },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (transactions.length > 10) {
      return NextResponse.json({ error: 'Max 10 transactions per batch' }, { status: 400 })
    }

    for (const tx of transactions) {
      if (!tx.to || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) {
        return NextResponse.json(
          { error: `Invalid "to" address: ${tx.to}` },
          { status: 400 }
        )
      }
    }

    console.log(`[/api/biconomy/relay] Relaying ${transactions.length} tx(s) on ${chain}`)

    const client = await getBiconomyClient(chain as SupportedChain)
    const result = await client.sendBatch(transactions)

    return NextResponse.json(result)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[/api/biconomy/relay] Error:', message)

    if (message.includes('BICONOMY_API_KEY')) {
      return NextResponse.json({ error: 'Biconomy not configured. Set BICONOMY_API_KEY' }, { status: 503 })
    }
    if (message.includes('ETH_PRIVATE_KEY')) {
      return NextResponse.json({ error: 'ETH signer not configured. Set ETH_PRIVATE_KEY' }, { status: 503 })
    }
    if (message.includes('AA21') || message.includes('insufficient funds')) {
      return NextResponse.json({ error: 'Paymaster balance too low' }, { status: 402 })
    }

    return NextResponse.json({ error: message ?? 'Unknown relay error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const chain = (searchParams.get('chain') ?? 'base') as SupportedChain

    if (!CHAIN_CONFIGS[chain]) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 })
    }

    const client = await getBiconomyClient(chain)
    const config = client.getChainConfig()

    return NextResponse.json({
      smartAccountAddress: client.getAddress(),
      chain,
      chainId:     config.chainId,
      chainName:   config.name,
      explorerUrl: `${config.explorerUrl}/address/${client.getAddress()}`,
      status:      'ready',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
