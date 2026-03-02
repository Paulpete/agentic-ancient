/**
 * POST /api/clawpump/launch
 * Launch a token on pump.fun via ClawPump.
 * Tries gasless first; falls back to self-funded on 503.
 *
 * Body: { mode: 'gasless'|'self-funded', ...LaunchParams, txSignature?, devBuySol? }
 */
import { NextResponse } from 'next/server'
import {
  launchGasless,
  launchSelfFunded,
  getSelfFundedInfo,
  validateLaunchParams,
  type LaunchParams,
  type SelfFundedLaunchParams,
} from '@/lib/clawpump/client'

function isAuthorized(request: Request): boolean {
  const required = process.env.RALPH_API_KEY
  if (!required) return true
  return request.headers.get('x-api-key') === required
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { mode = 'gasless', txSignature, devBuySol, ...params } = body as
      Partial<SelfFundedLaunchParams> & { mode?: 'gasless' | 'self-funded' }

    const validationError = validateLaunchParams(params)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const launchParams = params as LaunchParams

    if (mode === 'self-funded') {
      if (!txSignature) {
        return NextResponse.json({ error: 'txSignature required for self-funded mode' }, { status: 400 })
      }
      const result = await launchSelfFunded({ ...launchParams, txSignature, devBuySol })
      return NextResponse.json(result)
    }

    // Gasless (default)
    const result = await launchGasless(launchParams)
    return NextResponse.json(result)

  } catch (err: unknown) {
    const error = err as any
    const status = error.status ?? 500
    const message = error.data?.error ?? error.message ?? 'Launch failed'

    return NextResponse.json(
      { error: message, details: error.data?.details, retryAfterHours: error.data?.retryAfterHours, suggestions: error.data?.suggestions },
      { status }
    )
  }
}

/**
 * GET /api/clawpump/launch
 * Returns self-funded launch info (platform wallet + cost).
 */
export async function GET() {
  try {
    const info = await getSelfFundedInfo()
    return NextResponse.json(info)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
