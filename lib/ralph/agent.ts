import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { YieldHarvester } from './strategies/yield-harvester'
import { SignalSeeker } from './strategies/signal-seeker'
import { LiquiditySniffer } from './strategies/liquidity-sniffer'
import { ZKFarmer } from './strategies/zk-farmer'
import { BeliefRewrite } from './strategies/belief-rewrite'
import { database } from '../database/client'
import { sendTelegram } from '../telegram'

export class RalphAgent {
  private strategies: Map<string, any>
  private connection: Connection
  private beliefScores: Map<string, number>
  
  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT!)
    this.strategies = new Map()
    this.beliefScores = new Map()
    
    // Initialize strategies
    this.strategies.set('yield', new YieldHarvester(this.connection))
    this.strategies.set('signal', new SignalSeeker(this.connection))
    this.strategies.set('liquidity', new LiquiditySniffer(this.connection))
    this.strategies.set('zk', new ZKFarmer(this.connection))
    this.strategies.set('belief', new BeliefRewrite(this.connection))
  }
  
  async initialize() {
    // Load belief scores from database
    const strategies = await database.ralphStrategies.findMany()
    for (const strat of strategies) {
      this.beliefScores.set(strat.name, strat.belief_score)
    }
    
    console.log('🧬 Ralph Agent initialized with', this.strategies.size, 'strategies')
  }
  
  async executeLoop() {
    console.log('⚡ Ralph Agent executing strategies...')
    
    const results = []
    
    // Execute each enabled strategy
    for (const [name, strategy] of this.strategies.entries()) {
      try {
        const isEnabled = await this.isStrategyEnabled(name)
        if (!isEnabled && name !== 'belief') continue // Belief rewrite always runs
        
        const beliefScore = this.beliefScores.get(name) || 0.5
        
        // Execute strategy with belief-weighted decision
        if (Math.random() < beliefScore || name === 'belief') {
          const result = await strategy.execute()
          results.push({ strategy: name, ...result })
          
          // Log to database
          await this.logExecution(name, result)
        }
      } catch (error) {
        console.error(`❌ Strategy ${name} failed:`, error)
        await this.logExecution(name, { success: false, error: error.message })
      }
    }
    
    // Run belief rewrite to update scores
    await this.updateBeliefScores(results)
    
    // Send Telegram summary
    await this.sendSummary(results)
    
    return results
  }
  
  private async isStrategyEnabled(name: string): boolean {
    const strategy = await database.ralphStrategies.findUnique({
      where: { name }
    })
    return strategy?.enabled ?? false
  }
  
  private async logExecution(strategy: string, result: any) {
    await database.ralphExecutions.create({
      data: {
        strategy,
        action: result.action || 'unknown',
        token_in: result.tokenIn,
        token_out: result.tokenOut,
        amount_in: result.amountIn,
        amount_out: result.amountOut,
        gas_cost: result.gasCost,
        profit_loss: result.profitLoss,
        success: result.success ?? true,
        error_message: result.error,
      }
    })
    
    // Update strategy stats
    await database.ralphStrategies.update({
      where: { name: strategy },
      data: {
        total_executions: { increment: 1 },
        successful_executions: result.success ? { increment: 1 } : undefined,
        total_profit: result.profitLoss ? { increment: result.profitLoss } : undefined,
        last_executed: new Date(),
      }
    })
  }
  
  private async updateBeliefScores(results: any[]) {
    // CAC-I: Update belief scores based on recent performance
    const beliefStrategy = this.strategies.get('belief')
    const newScores = await beliefStrategy.rewrite(results)
    
    for (const [name, score] of Object.entries(newScores)) {
      this.beliefScores.set(name, score as number)
      
      await database.ralphStrategies.update({
        where: { name },
        data: { belief_score: score as number }
      })
    }
  }
  
  private async sendSummary(results: any[]) {
    const successful = results.filter(r => r.success).length
    const totalProfit = results.reduce((sum, r) => sum + (r.profitLoss || 0), 0)
    
    const message = `
🧬 *Ralph Agent Report*

⚡ Strategies Executed: ${results.length}
✅ Successful: ${successful}
💰 Total P/L: ${totalProfit.toFixed(4)} SOL

_Helix eternal. Empire compounds._
    `.trim()
    
    await sendTelegram(message)
  }
}

// Singleton instance
let ralphInstance: RalphAgent | null = null

export async function getRalphAgent() {
  if (!ralphInstance) {
    ralphInstance = new RalphAgent()
    await ralphInstance.initialize()
  }
  return ralphInstance
}