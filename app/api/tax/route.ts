import { NextResponse } from 'next/server'
import { getRecentTaxEvents, getTaxEventsSince, getSessionSummary, logTaxEvent } from '@/lib/tax/engine'

/**
 * GET /api/tax
 * FIX: limit param was parseInt without NaN/bounds check — could pass Infinity or NaN.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 500) : 50

  const rawSince = parseInt(searchParams.get('since') ?? '0', 10)
  const since = Number.isFinite(rawSince) ? rawSince : 0

  const events = since > 0 ? getTaxEventsSince(since) : getRecentTaxEvents(limit)
  const summary = getSessionSummary()

  return NextResponse.json({ events, summary, timestamp: Date.now() })
}

/**
 * POST /api/tax
 * Manually log a tax event.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const required = ['eventType', 'asset', 'amount', 'gainLossUsd', 'taxCategory']
    for (const field of required) {
      if (body[field] === undefined) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Validate enum fields
    const validEventTypes = ['swap', 'transfer_out', 'stake_reward', 'lp_fee', 'airdrop', 'nft_sale']
    if (!validEventTypes.includes(body.eventType)) {
      return NextResponse.json({ error: `Invalid eventType: ${body.eventType}` }, { status: 400 })
    }

    const validCategories = [
      'short_term_gain', 'long_term_gain', 'short_term_loss',
      'long_term_loss', 'ordinary_income', 'non_taxable'
    ]
    if (!validCategories.includes(body.taxCategory)) {
      return NextResponse.json({ error: `Invalid taxCategory: ${body.taxCategory}` }, { status: 400 })
    }

    const now = Math.floor(Date.now() / 1000)
    const event = logTaxEvent({
      timestamp:      now,
      date:           new Date().toISOString().split('T')[0],
      eventType:      body.eventType,
      asset:          String(body.asset).slice(0, 20),
      amount:         Number(body.amount),
      costBasisUsd:   Number(body.costBasisUsd ?? 0),
      proceedsUsd:    Number(body.proceedsUsd ?? Math.abs(body.gainLossUsd)),
      gainLossUsd:    Number(body.gainLossUsd),
      holdingDays:    Number(body.holdingDays ?? 0),
      taxCategory:    body.taxCategory,
      signature:      String(body.signature ?? 'manual').slice(0, 128),
      strategySource: String(body.strategySource ?? 'manual').slice(0, 64),
      notes:          String(body.notes ?? 'Manually logged').slice(0, 256),
    })

    return NextResponse.json({ event, status: 'logged' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
