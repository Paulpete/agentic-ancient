/**
 * GET /api/clawpump/history?agentId=<wallet>&limit=20
 */
import { NextResponse } from 'next/server'
import { getLaunchHistory } from '@/lib/clawpump/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId') ?? process.env.AGENT_WALLET_ADDRESS ?? ''
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 20

  if (!agentId) {
    return NextResponse.json({ error: 'agentId param required' }, { status: 400 })
  }

  try {
    const launches = await getLaunchHistory(agentId, limit)
    return NextResponse.json({ launches, count: launches.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
