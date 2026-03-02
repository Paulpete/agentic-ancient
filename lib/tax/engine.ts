/**
 * lib/tax/engine.ts
 * 
 * Bridge between the Next.js API layer and the Python solana-tax skill.
 * Spawns the tax_engine.py subprocess and returns structured results.
 * Also provides an in-memory event log for real-time tax tracking
 * as the Ralph agent executes swaps and sweeps.
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxEvent {
  id: string
  timestamp: number
  date: string
  eventType: 'swap' | 'transfer_out' | 'stake_reward' | 'lp_fee' | 'airdrop' | 'nft_sale'
  asset: string
  amount: number
  costBasisUsd: number
  proceedsUsd: number
  gainLossUsd: number
  holdingDays: number
  taxCategory: 'short_term_gain' | 'long_term_gain' | 'short_term_loss' | 'long_term_loss' | 'ordinary_income' | 'non_taxable'
  signature: string
  strategySource?: string    // Which Ralph strategy triggered this
  notes: string
}

export interface TaxSummary {
  wallet: string
  year: number
  method: string
  generatedAt: string
  totalGains: number
  totalLosses: number
  netCapitalGain: number
  shortTermGains: number
  longTermGains: number
  totalIncome: number
  estimatedTax: number
  transactionsAnalyzed: number
  taxableEvents: number
  incomeEvents: number
  csvPath?: string
  jsonPath?: string
}

// ─── In-memory event log ──────────────────────────────────────────────────────
// Ralph adds events here in real-time as strategies execute.
// The /api/tax route reads from this log.

const taxEventLog: TaxEvent[] = []
const MAX_LOG_SIZE = 500

export function logTaxEvent(event: Omit<TaxEvent, 'id'>): TaxEvent {
  const fullEvent: TaxEvent = {
    ...event,
    id: `tax_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  }

  taxEventLog.unshift(fullEvent) // newest first

  if (taxEventLog.length > MAX_LOG_SIZE) {
    taxEventLog.splice(MAX_LOG_SIZE)
  }

  console.log(
    `[TAX ENGINE] ${event.eventType.toUpperCase()} | ${event.asset} | ` +
    `${event.gainLossUsd >= 0 ? '+' : ''}$${event.gainLossUsd.toFixed(2)} | ` +
    `${event.taxCategory}`
  )

  return fullEvent
}

export function getRecentTaxEvents(limit = 50): TaxEvent[] {
  return taxEventLog.slice(0, limit)
}

export function getTaxEventsSince(timestamp: number): TaxEvent[] {
  return taxEventLog.filter(e => e.timestamp >= timestamp)
}

export function getSessionSummary(): {
  totalGainLoss: number
  ordinaryIncome: number
  eventCount: number
  byCategory: Record<string, number>
} {
  const byCategory: Record<string, number> = {}
  let totalGainLoss = 0
  let ordinaryIncome = 0

  for (const e of taxEventLog) {
    byCategory[e.taxCategory] = (byCategory[e.taxCategory] ?? 0) + 1

    if (e.taxCategory === 'ordinary_income') {
      ordinaryIncome += e.gainLossUsd
    } else if (e.taxCategory !== 'non_taxable') {
      totalGainLoss += e.gainLossUsd
    }
  }

  return {
    totalGainLoss: Math.round(totalGainLoss * 100) / 100,
    ordinaryIncome: Math.round(ordinaryIncome * 100) / 100,
    eventCount: taxEventLog.length,
    byCategory,
  }
}

// ─── Full report (spawns Python engine) ──────────────────────────────────────

export async function generateFullReport(
  wallet: string,
  year: number,
  method: 'fifo' | 'lifo' | 'hifo' = 'fifo',
  rpcUrl?: string
): Promise<TaxSummary> {
  const scriptPath = path.resolve(process.cwd(), 'skills/solana-tax/scripts/tax_engine.py')
  const outDir = '/tmp/clawai_tax_reports'

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const csvOut  = path.join(outDir, `tax_${wallet.slice(0, 8)}_${year}_${method}.csv`)
  const jsonOut = path.join(outDir, `tax_${wallet.slice(0, 8)}_${year}_${method}.json`)

  return new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      'report',
      wallet,
      '--year', String(year),
      '--method', method,
      '--out-csv', csvOut,
      '--out-json', jsonOut,
    ]

    if (rpcUrl) args.push('--rpc', rpcUrl)

    const child = spawn('python3', args, {
      env: { ...process.env },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('[TAX ENGINE] Python error:', stderr)
        reject(new Error(`Tax engine exited with code ${code}: ${stderr}`))
        return
      }

      // Parse the JSON output
      try {
        if (fs.existsSync(jsonOut)) {
          const raw = JSON.parse(fs.readFileSync(jsonOut, 'utf-8'))
          const summary: TaxSummary = {
            wallet: raw.wallet,
            year: raw.year,
            method: raw.method,
            generatedAt: raw.generated_at,
            totalGains: raw.total_gains,
            totalLosses: raw.total_losses,
            netCapitalGain: raw.net_capital_gain,
            shortTermGains: raw.short_term_gains,
            longTermGains: raw.long_term_gains,
            totalIncome: raw.total_income,
            estimatedTax: raw.estimated_tax,
            transactionsAnalyzed: raw.summary?.transactions_analyzed ?? 0,
            taxableEvents: raw.summary?.taxable_events ?? 0,
            incomeEvents: raw.summary?.income_events ?? 0,
            csvPath: csvOut,
            jsonPath: jsonOut,
          }
          resolve(summary)
        } else {
          // Engine ran but produced no JSON — parse stdout for numbers
          resolve(parseSummaryFromStdout(wallet, year, method, stdout))
        }
      } catch (e) {
        reject(new Error(`Failed to parse tax report JSON: ${e}`))
      }
    })

    child.on('error', (err) => {
      // Python not available — return empty summary gracefully
      console.warn('[TAX ENGINE] python3 not found, returning empty summary')
      resolve({
        wallet,
        year,
        method,
        generatedAt: new Date().toISOString(),
        totalGains: 0,
        totalLosses: 0,
        netCapitalGain: 0,
        shortTermGains: 0,
        longTermGains: 0,
        totalIncome: 0,
        estimatedTax: 0,
        transactionsAnalyzed: 0,
        taxableEvents: 0,
        incomeEvents: 0,
      })
    })
  })
}

function parseSummaryFromStdout(
  wallet: string,
  year: number,
  method: string,
  stdout: string
): TaxSummary {
  const extract = (pattern: RegExp): number => {
    const m = stdout.match(pattern)
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0
  }

  return {
    wallet,
    year,
    method,
    generatedAt: new Date().toISOString(),
    totalGains: extract(/Short-Term Gains.*?\$([\d,.]+)/),
    totalLosses: extract(/Total Losses.*?\$([\d,.]+)/),
    netCapitalGain: extract(/Net Capital Gain.*?\$([\d,.]+)/),
    shortTermGains: extract(/Short-Term Gains.*?\$([\d,.]+)/),
    longTermGains: extract(/Long-Term Gains.*?\$([\d,.]+)/),
    totalIncome: extract(/Ordinary Income.*?\$([\d,.]+)/),
    estimatedTax: extract(/Est\. Tax Owed.*?\$([\d,.]+)/),
    transactionsAnalyzed: extract(/Transactions\s+:\s+(\d+)/),
    taxableEvents: extract(/Taxable Events\s+:\s+(\d+)/),
    incomeEvents: extract(/Income Events\s+:\s+(\d+)/),
  }
}

// ─── Strategy result → tax event converter ───────────────────────────────────
// Called by RalphAgent after each strategy execution to log tax events.

export function strategyResultToTaxEvent(
  result: {
    strategy: string
    action?: string
    asset?: string
    amountIn?: number
    amountOut?: number
    profitLoss?: number
    success?: boolean
    signature?: string
  },
  walletAddress: string
): TaxEvent | null {
  if (!result.success || !result.profitLoss || result.profitLoss === 0) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const gainLoss = result.profitLoss

  // Determine event type and tax category from strategy type
  let eventType: TaxEvent['eventType'] = 'swap'
  let taxCategory: TaxEvent['taxCategory']

  if (result.strategy === 'yield' || result.strategy === 'zk') {
    eventType = 'lp_fee'
    taxCategory = 'ordinary_income'
  } else if (result.strategy === 'signal' || result.strategy === 'arbitrage') {
    eventType = 'swap'
    taxCategory = gainLoss >= 0 ? 'short_term_gain' : 'short_term_loss'
  } else if (result.strategy === 'liquidity') {
    eventType = 'lp_fee'
    taxCategory = 'ordinary_income'
  } else {
    taxCategory = gainLoss >= 0 ? 'short_term_gain' : 'short_term_loss'
  }

  return logTaxEvent({
    timestamp: now,
    date: new Date(now * 1000).toISOString().split('T')[0],
    eventType,
    asset: result.asset ?? 'SOL',
    amount: result.amountIn ?? 0,
    costBasisUsd: 0,
    proceedsUsd: Math.abs(gainLoss),
    gainLossUsd: gainLoss,
    holdingDays: 0,
    taxCategory,
    signature: result.signature ?? 'pending',
    strategySource: result.strategy,
    notes: `Ralph ${result.strategy} strategy | action: ${result.action ?? 'execute'}`,
  })
}
