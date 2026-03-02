/**
 * GET /api/clawpump/quote?inputMint=<mint>&outputMint=<mint>&amount=<lamports>&slippageBps=100
 */
import { NextResponse } from 'next/server'
import { getSwapQuote } from '@/lib/clawpump/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const inputMint   = searchParams.get('inputMint')  ?? ''
  const outputMint  = searchParams.get('outputMint') ?? ''
  const rawAmount   = parseInt(searchParams.get('amount') ?? '0', 10)
  const slippageBps = parseInt(searchParams.get('slippageBps') ?? '100', 10)

  if (!inputMint || !outputMint) {
    return NextResponse.json({ error: 'inputMint and outputMint are required' }, { status: 400 })
  }

  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive integer (in smallest units)' }, { status: 400 })
  }

  try {
    const quote = await getSwapQuote(inputMint, outputMint, rawAmount, slippageBps)
    return NextResponse.json(quote)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
