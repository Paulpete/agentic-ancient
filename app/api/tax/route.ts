import { NextResponse } from 'next/server'
import {
  getRecentTaxEvents,
  getSessionSummary,
  logTaxEvent,
} from '@/lib/tax/engine'

/**
 * GET /api/tax
 * Returns the real-time tax event log captured from Ralph strategy executions.
 * Also includes a running session summary (cumulative gain/loss this session).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const since = parseInt(searchParams.get('since') ?? '0')

  const events = since > 0
    ? (await import('@/lib/tax/engine')).getTaxEventsSince(since)
    : getRecentTaxEvents(limit)

  const summary = getSessionSummary()

  return NextResponse.json({
    events,
    summary,
    timestamp: Date.now(),
  })
}

/**
 * POST /api/tax
 * Manually log a tax event (e.g. from an external sweep or bridge operation).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const required = ['eventType', 'asset', 'amount', 'gainLossUsd', 'taxCategory']
    for (const field of required) {
      if (body[field] === undefined) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    const now = Math.floor(Date.now() / 1000)

    const event = logTaxEvent({
      timestamp: now,
      date: new Date().toISOString().split('T')[0],
      eventType: body.eventType,
      asset: body.asset,
      amount: body.amount,
      costBasisUsd: body.costBasisUsd ?? 0,
      proceedsUsd: body.proceedsUsd ?? Math.abs(body.gainLossUsd),
      gainLossUsd: body.gainLossUsd,
      holdingDays: body.holdingDays ?? 0,
      taxCategory: body.taxCategory,
      signature: body.signature ?? 'manual',
      strategySource: body.strategySource ?? 'manual',
      notes: body.notes ?? 'Manually logged',
    })

    return NextResponse.json({ event, status: 'logged' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
