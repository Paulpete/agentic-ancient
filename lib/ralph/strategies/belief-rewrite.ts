import { Connection } from '@solana/web3.js'

export class BeliefRewrite {
  constructor(private connection: Connection) {}

  // FIX: Key names now match exactly the strategy keys registered in agent.ts.
  // Was: 'yield-harvester', 'signal-seeker', etc. — never matched 'yield', 'signal'.
  // Belief updates were silently discarded every cycle.
  async rewrite(results: any[]): Promise<Record<string, number>> {
    console.log('🧠 [BeliefRewrite] Running CAC-I belief update...')

    // Compute per-strategy performance from this cycle's results
    const perfMap: Record<string, { pnl: number; success: boolean }> = {}
    for (const r of results) {
      if (r.strategy && r.strategy !== 'belief') {
        perfMap[r.strategy] = {
          pnl:     r.profitLoss ?? 0,
          success: r.success ?? false,
        }
      }
    }

    // Bayesian-style update: reward profit, penalize loss/failure
    const defaults: Record<string, number> = {
      yield: 0.7, signal: 0.6, liquidity: 0.5, zk: 0.7, belief: 1.0
    }

    const updated: Record<string, number> = { ...defaults }

    for (const [name, perf] of Object.entries(perfMap)) {
      const current = defaults[name] ?? 0.5
      let delta = 0

      if (perf.success && perf.pnl > 0)      delta = +0.05
      else if (perf.success && perf.pnl === 0) delta = 0
      else if (!perf.success)                  delta = -0.08
      else if (perf.pnl < 0)                   delta = -0.05

      updated[name] = Math.max(0.1, Math.min(1.0, current + delta))
    }

    updated['belief'] = 1.0 // belief rewrite always runs

    console.log('🧠 [BeliefRewrite] New scores:', updated)
    return updated
  }

  // execute() shim so agent.ts .execute() calls don't throw
  async execute() {
    return { success: true, action: 'belief_rewrite', profitLoss: 0 }
  }
}
