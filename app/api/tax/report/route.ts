import { NextResponse } from 'next/server'
import { generateFullReport } from '@/lib/tax/engine'

/**
 * POST /api/tax/report
 * Triggers the Python solana-tax engine to generate a full tax report.
 * 
 * Body: { wallet, year, method, rpcUrl }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { wallet, year, method = 'fifo', rpcUrl } = body

    if (!wallet) {
      return NextResponse.json({ error: 'wallet is required' }, { status: 400 })
    }

    const walletPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!walletPattern.test(wallet)) {
      return NextResponse.json({ error: 'Invalid Solana wallet address' }, { status: 400 })
    }

    const reportYear = year ?? new Date().getFullYear()

    const summary = await generateFullReport(
      wallet,
      reportYear,
      method as 'fifo' | 'lifo' | 'hifo',
      rpcUrl
    )

    return NextResponse.json({ summary, status: 'complete' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/tax/report?wallet=...&year=...&method=...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get('wallet')
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const method = (searchParams.get('method') ?? 'fifo') as 'fifo' | 'lifo' | 'hifo'
  const rpcUrl = searchParams.get('rpc') ?? undefined

  if (!wallet) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 })
  }

  const summary = await generateFullReport(wallet, year, method, rpcUrl)
  return NextResponse.json({ summary, status: 'complete' })
}
