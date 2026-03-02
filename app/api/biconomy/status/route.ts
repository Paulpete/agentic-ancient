/**
 * GET /api/biconomy/status?userOpHash=0x...&chain=base
 *
 * Poll the bundler for a UserOperation's confirmation status.
 * Frontend uses this to show "confirming..." → "confirmed ✅" in the UI.
 *
 * Returns:
 *   { status: 'pending' | 'confirmed' | 'failed', txHash?, explorerUrl? }
 */

import { NextResponse } from 'next/server'
import { getBiconomyClient, SupportedChain, CHAIN_CONFIGS } from '@/lib/ethereum/biconomy'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userOpHash = searchParams.get('userOpHash') ?? searchParams.get('hash')
    const chain      = (searchParams.get('chain') ?? 'base') as SupportedChain

    if (!userOpHash) {
      return NextResponse.json({ error: 'userOpHash param required' }, { status: 400 })
    }

    if (!CHAIN_CONFIGS[chain]) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 })
    }

    const client = await getBiconomyClient(chain)
    const result  = await client.getUserOpStatus(userOpHash)

    return NextResponse.json({
      userOpHash,
      chain,
      ...result,
      explorerUrl: result.txHash
        ? `${CHAIN_CONFIGS[chain].explorerUrl}/tx/${result.txHash}`
        : undefined,
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
