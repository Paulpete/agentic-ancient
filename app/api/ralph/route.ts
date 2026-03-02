import { NextResponse } from 'next/server'
import { RalphLoop } from '@/lib/ralph/loop'

// FIX: Module-level state is unreliable in serverless (Vercel cold starts lose it).
// Using globalThis to persist across hot reloads in dev and long-lived server instances.
// For true serverless persistence, a DB/Redis lock would be needed.
declare global {
  // eslint-disable-next-line no-var
  var __ralphLoop: RalphLoop | undefined
}

// FIX: Added internal API key check — anyone could start/stop Ralph previously.
// Set RALPH_API_KEY in .env.local. If unset, falls back to allowing all (dev mode).
function isAuthorized(request: Request): boolean {
  const required = process.env.RALPH_API_KEY
  if (!required) return true // dev mode: no key configured = open
  const provided = request.headers.get('x-api-key') ?? ''
  return provided === required
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (global.__ralphLoop?.isRunning()) {
    return NextResponse.json({ status: 'already_running' })
  }

  global.__ralphLoop = new RalphLoop()
  global.__ralphLoop.start().catch(err => {
    console.error('[Ralph Route] Loop crashed:', err)
    global.__ralphLoop = undefined
  })

  return NextResponse.json({ status: 'initiated', message: 'Ralph Loop started' })
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!global.__ralphLoop?.isRunning()) {
    return NextResponse.json({ status: 'not_running' })
  }

  global.__ralphLoop.stop()
  global.__ralphLoop = undefined

  return NextResponse.json({ status: 'stopped' })
}

export async function GET() {
  return NextResponse.json({
    status: global.__ralphLoop?.isRunning() ? 'running' : 'stopped'
  })
}
