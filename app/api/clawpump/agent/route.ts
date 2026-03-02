/**
 * POST /api/clawpump/agent
 * Natural language ClawPump agent — parses text and executes the right flow.
 *
 * Body: { text: string, walletAddress?: string, confirm?: boolean, pendingLaunch?: LaunchParams }
 *
 * If confirm=true and pendingLaunch is provided, executes the confirmed launch.
 * Otherwise, parses intent and returns result or confirmation prompt.
 */
import { NextResponse } from 'next/server'
import { getClawPumpAgent } from '@/lib/clawpump/agent'
import type { LaunchParams } from '@/lib/clawpump/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      text         = '',
      walletAddress,
      confirm      = false,
      pendingLaunch,
      selfFunded   = false,
      txSignature,
      devBuySol,
    } = body as {
      text?:          string
      walletAddress?: string
      confirm?:       boolean
      pendingLaunch?: LaunchParams
      selfFunded?:    boolean
      txSignature?:   string
      devBuySol?:     number
    }

    const wallet = walletAddress ?? process.env.AGENT_WALLET_ADDRESS ?? ''
    if (!wallet) {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 })
    }

    const agent = getClawPumpAgent(wallet)

    // Confirmed launch path
    if (confirm && pendingLaunch) {
      const result = await agent.launchConfirmed(pendingLaunch, selfFunded, txSignature, devBuySol)
      return NextResponse.json(result)
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const result = await agent.run(text)
    return NextResponse.json(result)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
