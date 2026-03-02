import { NextResponse } from 'next/server'
import { generateFullReport } from '@/lib/tax/engine'

// FIX: Added RALPH_API_KEY guard — this route triggers expensive Python subprocess.
// Previously callable by anyone without auth.
function isAuthorized(request: Request): boolean {
  const required = process.env.RALPH_API_KEY
  if (!required) return true
  return request.headers.get('x-api-key') === required
}

const VALID_METHODS = ['fifo', 'lifo', 'hifo'] as const
type Method = typeof VALID_METHODS[number]

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * POST /api/tax/report
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { wallet, year, method = 'fifo', rpcUrl } = body

    if (!wallet || !WALLET_RE.test(wallet)) {
      return NextResponse.json({ error: 'Invalid or missing Solana wallet address' }, { status: 400 })
    }

    if (!VALID_METHODS.includes(method)) {
      return NextResponse.json({ error: `Invalid method. Must be: ${VALID_METHODS.join(', ')}` }, { status: 400 })
    }

    const reportYear = Number.isFinite(year) ? year : new Date().getFullYear()
    if (reportYear < 2020 || reportYear > new Date().getFullYear()) {
      return NextResponse.json({ error: 'Year out of range' }, { status: 400 })
    }

    // Validate rpcUrl if provided
    if (rpcUrl && !/^https?:\/\//.test(rpcUrl)) {
      return NextResponse.json({ error: 'Invalid rpcUrl' }, { status: 400 })
    }

    const summary = await generateFullReport(wallet, reportYear, method as Method, rpcUrl)
    return NextResponse.json({ summary, status: 'complete' })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/tax/report?wallet=...&year=...&method=...
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const wallet  = searchParams.get('wallet') ?? ''
  const method  = (searchParams.get('method') ?? 'fifo') as Method
  const rpcUrl  = searchParams.get('rpc') ?? undefined

  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: 'Invalid or missing wallet param' }, { status: 400 })
  }

  const rawYear = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)
  const year = Number.isFinite(rawYear) ? rawYear : new Date().getFullYear()

  if (!VALID_METHODS.includes(method)) {
    return NextResponse.json({ error: `Invalid method` }, { status: 400 })
  }

  try {
    const summary = await generateFullReport(wallet, year, method, rpcUrl)
    return NextResponse.json({ summary, status: 'complete' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
