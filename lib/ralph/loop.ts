import { getRalphAgent } from './agent'

export class RalphLoop {
  private running = false
  private interval: number
  private iteration = 0
  
  constructor(intervalMs: number = 60000) {
    this.interval = intervalMs
  }
  
  async start() {
    if (this.running) return
    
    this.running = true
    console.log('🔄 Ralph Loop initiated')
    
    const agent = await getRalphAgent()
    
    while (this.running) {
      this.iteration++
      try {
        await agent.executeLoop()
      } catch (error) {
        console.error(
          `❌ Loop iteration #${this.iteration} failed during agent.executeLoop():`,
          error
        )
      }
      
      await new Promise(resolve => setTimeout(resolve, this.interval))
    }
  }
  
  stop() {
    this.running = false
    console.log('🛑 Ralph Loop stopped')
  }
}
