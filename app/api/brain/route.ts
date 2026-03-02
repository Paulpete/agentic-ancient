import { NextResponse } from 'next/server'
import fs from 'fs'

const CHECKPOINT = '/tmp/clawai_self_learning_state.json'

/**
 * GET /api/brain
 * Returns self-learning engine state: Q-learning epsilon, GA generation,
 * per-strategy Bayesian beliefs, fitness scores, recent history.
 * Reads directly from the checkpoint file written by self_learning_engine.py.
 */
export async function GET() {
  try {
    if (!fs.existsSync(CHECKPOINT)) {
      return NextResponse.json({
        status: 'not_initialized',
        note: 'Run python3 run_ralph_terminal.py to activate the self-learning engine',
        epsilon: null,
        ga_generation: 0,
        cycle_count: 0,
        strategies: {},
        history: [],
      })
    }

    const raw  = fs.readFileSync(CHECKPOINT, 'utf-8')
    const data = JSON.parse(raw)

    // Compute derived stats per strategy
    const strategies: Record<string, unknown> = {}
    for (const [name, state] of Object.entries(data.states ?? {}) as [string, any][]) {
      const alpha = state.alpha ?? 2
      const beta  = state.beta  ?? 2
      const bayesian = alpha / (alpha + beta)
      const n        = alpha + beta
      const uncertainty = (alpha * beta) / (n * n * (n + 1))
      strategies[name] = {
        bayesian_belief: Math.round(bayesian * 10000) / 10000,
        uncertainty:     Math.round(uncertainty * 100000) / 100000,
        total_pnl:       Math.round((state.total_pnl ?? 0) * 10000) / 10000,
        exec_count:      state.exec_count ?? 0,
        alpha:           Math.round(alpha * 100) / 100,
        beta:            Math.round(beta  * 100) / 100,
      }
    }

    return NextResponse.json({
      status:         'active',
      cycle_count:    data.cycle_count  ?? 0,
      epsilon:        data.epsilon      ?? 0,
      ga_generation:  data.ga_generation ?? 0,
      strategies,
      history:        (data.history ?? []).slice(-10),
      checkpoint_age: Math.floor((Date.now() / 1000) - (fs.statSync(CHECKPOINT).mtimeMs / 1000)) + 's ago',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/brain
 * Manually inject a result into the self-learning engine.
 * Body: { strategy, success, profit_loss }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.strategy) {
      return NextResponse.json({ error: 'strategy is required' }, { status: 400 })
    }

    // Append to a pending queue file — picked up by running engine
    const QUEUE = '/tmp/clawai_sl_queue.jsonl'
    const line = JSON.stringify({
      strategy:     body.strategy,
      success:      body.success ?? false,
      profit_loss:  body.profit_loss ?? 0,
      timestamp:    Math.floor(Date.now() / 1000),
    }) + '\n'

    fs.appendFileSync(QUEUE, line)

    return NextResponse.json({ status: 'queued', entry: JSON.parse(line) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
