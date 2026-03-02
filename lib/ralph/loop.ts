import { getRalphAgent } from './agent'

// FIX: Added exponential backoff on consecutive errors, max error threshold,
// and proper abort mechanism. Previous loop ran forever even on fatal errors.

const MAX_CONSECUTIVE_ERRORS = 5
const BACKOFF_BASE_MS        = 5_000
const BACKOFF_MAX_MS         = 5 * 60_000 // 5 min cap

export class RalphLoop {
  private running           = false
  private interval:           number
  private iteration           = 0
  private consecutiveErrors   = 0
  private abortController: AbortController | null = null

  constructor(intervalMs: number = 60_000) {
    this.interval = intervalMs
  }

  async start() {
    if (this.running) return

    this.running          = true
    this.consecutiveErrors = 0
    this.abortController  = new AbortController()

    console.log('🔄 Ralph Loop initiated')

    const agent = await getRalphAgent()

    while (this.running && !this.abortController.signal.aborted) {
      this.iteration++
      try {
        await agent.executeLoop()
        this.consecutiveErrors = 0 // reset on success

      } catch (err: unknown) {
        this.consecutiveErrors++
        const message = err instanceof Error ? err.message : String(err)
        console.error(
          `❌ Loop iteration #${this.iteration} failed (${this.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${message}`
        )

        // FIX: abort loop after too many consecutive errors — prevents infinite crash loops
        if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error('💀 Ralph Loop: max consecutive errors reached — halting loop')
          this.running = false
          break
        }

        // Exponential backoff on errors
        const backoff = Math.min(
          BACKOFF_BASE_MS * Math.pow(2, this.consecutiveErrors - 1),
          BACKOFF_MAX_MS
        )
        console.log(`⏳ Backing off ${backoff / 1000}s before retry...`)
        await this.sleep(backoff)
        continue
      }

      await this.sleep(this.interval)
    }

    console.log(`🛑 Ralph Loop stopped after ${this.iteration} iterations`)
  }

  stop() {
    this.running = false
    this.abortController?.abort()
    console.log('🛑 Ralph Loop stopped')
  }

  isRunning() { return this.running }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
