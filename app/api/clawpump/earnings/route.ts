/**
 * GET /api/clawpump/earnings?agentId=<wallet>
 * Returns fee earnings for the given agent wallet.
 */
import { NextResponse } from 'next/server'
import { getEarnings } from '@/lib/clawpump/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId') ?? process.env.AGENT_WALLET_ADDRESS ?? ''

  if (!agentId) {
    return NextResponse.json({ error: 'agentId param required' }, { status: 400 })
  }

  try {
    const earnings = await getEarnings(agentId)
    return NextResponse.json(earnings)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
