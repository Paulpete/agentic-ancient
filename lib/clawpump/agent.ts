/**
 * lib/clawpump/agent.ts
 *
 * ClawAi natural language agent for ClawPump.
 * Parses free-text commands and executes the appropriate flow.
 *
 * Examples:
 *   "Launch a token called EmpireAI, symbol EMP, about autonomous DeFi agents"
 *   "Check my ClawPump earnings"
 *   "Show my launch history"
 *   "Search domains for empireai"
 *   "Get a swap quote: 1 SOL → USDC"
 */

import {
  launchGasless,
  getSelfFundedInfo,
  launchSelfFunded,
  getEarnings,
  getLaunchHistory,
  searchDomains,
  checkDomains,
  getSwapQuote,
  validateLaunchParams,
  MINT,
  type LaunchParams,
  type LaunchResult,
} from './client'

// ─── Intent detection ─────────────────────────────────────────────────────────

type Intent =
  | 'launch'
  | 'earnings'
  | 'history'
  | 'domain_search'
  | 'swap_quote'
  | 'unknown'

function detectIntent(text: string): Intent {
  const t = text.toLowerCase()
  if (/launch|create.*token|memecoin|pump\.fun|new token/.test(t))  return 'launch'
  if (/earn(ing)?s?|fee|how much|profit/.test(t))                    return 'earnings'
  if (/histor|launched|my token|past launch/.test(t))                return 'history'
  if (/domain|\.com|\.ai|\.io|\.xyz|\.dev|available/.test(t))       return 'domain_search'
  if (/quote|swap|price.*sol|sol.*price|convert/.test(t))            return 'swap_quote'
  return 'unknown'
}

// ─── Launch param extraction ──────────────────────────────────────────────────

function extractLaunchParams(text: string): Partial<LaunchParams> {
  const params: Partial<LaunchParams> = {}

  // Name: "called X", "named X", "token X", "name is X"
  const nameMatch = text.match(
    /(?:called?|named?|token(?:\s+name)?(?:\s+is)?|name\s*[:=]?)\s+["']?([A-Za-z0-9 _\-]{1,32})["']?/i
  )
  if (nameMatch) params.name = nameMatch[1].trim()

  // Symbol: "symbol X", "ticker X", "$X"
  const symMatch = text.match(/(?:symbol|ticker)\s*[:=]?\s*["']?\$?([A-Za-z0-9]{1,10})["']?/i)
    ?? text.match(/\$([A-Z]{2,10})\b/)
  if (symMatch) params.symbol = symMatch[1].toUpperCase()

  // Description: "about X", "description: X", content after the main params
  const descMatch = text.match(
    /(?:about|description\s*[:=]?|desc\s*[:=]?)\s*["']?(.{20,500})["']?$/i
  )
  if (descMatch) params.description = descMatch[1].trim().slice(0, 500)

  // Image URL
  const imgMatch = text.match(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?/i)
  if (imgMatch) params.imageUrl = imgMatch[0]

  return params
}

// ─── Swap param extraction ────────────────────────────────────────────────────

function extractSwapParams(text: string): {
  inputMint: string
  outputMint: string
  amount: number
} | null {
  const t = text.toLowerCase()

  const solToUsdc = t.match(/(\d+(?:\.\d+)?)\s*sol\s*(?:to|→|->)\s*usdc/i)
  if (solToUsdc) {
    return {
      inputMint:  MINT.SOL,
      outputMint: MINT.USDC,
      amount:     Math.round(parseFloat(solToUsdc[1]) * 1e9),
    }
  }

  const usdcToSol = t.match(/(\d+(?:\.\d+)?)\s*usdc\s*(?:to|→|->)\s*sol/i)
  if (usdcToSol) {
    return {
      inputMint:  MINT.USDC,
      outputMint: MINT.SOL,
      amount:     Math.round(parseFloat(usdcToSol[1]) * 1e6),
    }
  }

  return null
}

// ─── Domain keyword extraction ────────────────────────────────────────────────

function extractDomainQuery(text: string): string {
  // "search domains for empireai" | "is empireai.ai available" | "find domain empireai"
  const specific = text.match(/is\s+([a-z0-9-]+\.[a-z]+)\s+available/i)
  if (specific) return specific[1]

  const keyword = text.match(/(?:domain(?:s)?\s+for|find\s+domain|search\s+domain\s+for)\s+([a-z0-9-]+)/i)
  if (keyword) return keyword[1]

  // Fallback: extract any word that looks like a domain keyword
  const fallback = text.match(/\b([a-z][a-z0-9-]{2,20})\b/i)
  return fallback ? fallback[1] : ''
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export interface ClawPumpAgentResult {
  intent:   Intent
  success:  boolean
  data?:    unknown
  message:  string
  missing?: string[]  // fields still needed from user
}

export class ClawPumpAgent {
  private walletAddress: string

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress
  }

  async run(text: string): Promise<ClawPumpAgentResult> {
    const intent = detectIntent(text)

    switch (intent) {
      case 'launch':       return this.handleLaunch(text)
      case 'earnings':     return this.handleEarnings()
      case 'history':      return this.handleHistory()
      case 'domain_search':return this.handleDomains(text)
      case 'swap_quote':   return this.handleSwapQuote(text)
      default:
        return {
          intent: 'unknown',
          success: false,
          message: 'I can help you: launch a token, check earnings, see launch history, search domains, or get swap quotes. What would you like to do?',
        }
    }
  }

  // ─── Launch handler ─────────────────────────────────────────────────────────

  private async handleLaunch(text: string): Promise<ClawPumpAgentResult> {
    const params = extractLaunchParams(text)
    params.walletAddress = this.walletAddress
    params.agentId       = this.walletAddress

    // Check what's missing
    const missing: string[] = []
    if (!params.name)        missing.push('token name')
    if (!params.symbol)      missing.push('symbol (e.g. EMP)')
    if (!params.description) missing.push('description (at least 20 characters)')
    if (!params.imageUrl)    missing.push('image URL (direct link to PNG/JPEG/GIF/WebP)')

    if (missing.length > 0) {
      return {
        intent: 'launch',
        success: false,
        message: `To launch your token I still need: ${missing.join(', ')}. Please provide these.`,
        missing,
        data: params,
      }
    }

    const validationError = validateLaunchParams(params)
    if (validationError) {
      return {
        intent: 'launch',
        success: false,
        message: validationError,
      }
    }

    // ── Safety: confirmation required before any launch ──────────────────────
    // In autonomous mode this block surfaces the confirmation request.
    // The calling UI/agent must confirm with user before calling launchConfirmed().
    return {
      intent: 'launch',
      success: false,  // not launched yet — awaiting confirmation
      message: [
        '🐾 Ready to launch on ClawPump (gasless — FREE):',
        `  Name:        ${params.name}`,
        `  Symbol:      ${params.symbol!.toUpperCase()}`,
        `  Description: ${params.description!.slice(0, 80)}${params.description!.length > 80 ? '...' : ''}`,
        `  Image:       ${params.imageUrl}`,
        `  Wallet:      ${this.walletAddress.slice(0, 8)}...${this.walletAddress.slice(-4)}`,
        `  Cost:        FREE (gasless)`,
        `  Earnings:    65% of all trading fees`,
        '',
        'Reply "confirm launch" to proceed.',
      ].join('\n'),
      data: { pendingLaunch: params },
    }
  }

  async launchConfirmed(
    params: LaunchParams,
    selfFunded = false,
    txSignature?: string,
    devBuySol?: number
  ): Promise<ClawPumpAgentResult> {
    try {
      let result: LaunchResult

      if (selfFunded && txSignature) {
        result = await launchSelfFunded({ ...params, txSignature, devBuySol })
      } else {
        result = await launchGasless(params)
      }

      return {
        intent: 'launch',
        success: true,
        data: result,
        message: [
          `✅ Token launched on pump.fun!`,
          `  Name:    ${params.name} (${params.symbol})`,
          `  Mint:    ${result.mintAddress}`,
          `  🔗 pump.fun: ${result.pumpUrl}`,
          `  🔍 Explorer: ${result.explorerUrl}`,
          `  💰 You're now earning 65% of all trading fees automatically.`,
        ].join('\n'),
      }
    } catch (err: unknown) {
      const error = err as any

      // 503 — gasless unavailable, suggest self-funded
      if (error.status === 503) {
        const sfInfo = error.data?.suggestions?.paymentFallback?.selfFunded
        return {
          intent: 'launch',
          success: false,
          message: [
            '⚠️ Gasless launch is temporarily unavailable (treasury low).',
            sfInfo
              ? `Self-funded launch is available for ~${sfInfo.cost} SOL. Would you like to proceed?`
              : 'Please try again later.',
          ].join('\n'),
          data: { fallback: sfInfo },
        }
      }

      // 429 — rate limited
      if (error.status === 429) {
        const hours = error.data?.retryAfterHours ?? '24'
        return {
          intent: 'launch',
          success: false,
          message: `⏳ Rate limited — you can launch again in ${hours} hours.`,
        }
      }

      // 400 — validation error
      if (error.status === 400) {
        return {
          intent: 'launch',
          success: false,
          message: `❌ Launch failed: ${error.data?.details ?? error.message}`,
        }
      }

      return {
        intent: 'launch',
        success: false,
        message: `❌ Launch failed: ${error.message ?? 'Unknown error'}. Please try again.`,
      }
    }
  }

  // ─── Earnings handler ───────────────────────────────────────────────────────

  private async handleEarnings(): Promise<ClawPumpAgentResult> {
    try {
      const earnings = await getEarnings(this.walletAddress)
      const lines = [
        `💰 ClawPump Earnings — ${this.walletAddress.slice(0, 8)}...`,
        `  Total Earned:   ${earnings.totalEarned.toFixed(4)} SOL`,
        `  Sent to Wallet: ${earnings.totalSent.toFixed(4)} SOL`,
        `  Pending:        ${earnings.totalPending.toFixed(4)} SOL`,
      ]

      if (earnings.tokenBreakdown.length > 0) {
        lines.push('\n  Per Token:')
        for (const t of earnings.tokenBreakdown) {
          lines.push(`    ${t.mintAddress.slice(0, 8)}...  Collected: ${t.totalCollected.toFixed(4)} SOL | Your share: ${t.totalAgentShare.toFixed(4)} SOL`)
        }
      }

      return { intent: 'earnings', success: true, data: earnings, message: lines.join('\n') }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { intent: 'earnings', success: false, message: `Failed to fetch earnings: ${message}` }
    }
  }

  // ─── History handler ────────────────────────────────────────────────────────

  private async handleHistory(): Promise<ClawPumpAgentResult> {
    try {
      const launches = await getLaunchHistory(this.walletAddress)

      if (launches.length === 0) {
        return {
          intent: 'history',
          success: true,
          data: [],
          message: "You haven't launched any tokens yet. Say 'launch a token' to get started!",
        }
      }

      const lines = [`🐾 Your ClawPump Launches (${launches.length}):`]
      for (const l of launches) {
        lines.push(`  • ${l.name} ($${l.symbol}) — ${l.pumpUrl}`)
        lines.push(`    Mint: ${l.mintAddress}  |  Launched: ${l.launchedAt}`)
      }

      return { intent: 'history', success: true, data: launches, message: lines.join('\n') }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { intent: 'history', success: false, message: `Failed to fetch history: ${message}` }
    }
  }

  // ─── Domains handler ────────────────────────────────────────────────────────

  private async handleDomains(text: string): Promise<ClawPumpAgentResult> {
    try {
      const query = extractDomainQuery(text)
      if (!query) {
        return {
          intent: 'domain_search',
          success: false,
          message: 'Please specify a domain keyword or domain to check (e.g., "search domains for empireai").',
        }
      }

      // If query looks like a full domain, use check; else search
      const results = query.includes('.')
        ? await checkDomains([query])
        : await searchDomains(query)

      const lines = [`🔍 Domain Results for "${query}":`]
      for (const d of results) {
        const status = d.available ? '✅ Available' : '❌ Taken'
        const price  = d.available && d.price ? ` — $${d.price.toFixed(2)}` : ''
        lines.push(`  ${d.domain}  ${status}${price}`)
      }

      if (results.length === 0) lines.push('  No results found.')
      lines.push('\n  Note: Domain registration coming in a future ClawPump update.')

      return { intent: 'domain_search', success: true, data: results, message: lines.join('\n') }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { intent: 'domain_search', success: false, message: `Domain search failed: ${message}` }
    }
  }

  // ─── Swap quote handler ─────────────────────────────────────────────────────

  private async handleSwapQuote(text: string): Promise<ClawPumpAgentResult> {
    try {
      const swapParams = extractSwapParams(text)
      if (!swapParams) {
        return {
          intent: 'swap_quote',
          success: false,
          message: 'Please specify a swap like "1 SOL to USDC" or "100 USDC to SOL".',
        }
      }

      const quote = await getSwapQuote(
        swapParams.inputMint,
        swapParams.outputMint,
        swapParams.amount
      )

      const inputToken  = Object.entries(MINT).find(([, v]) => v === swapParams.inputMint)?.[0]  ?? swapParams.inputMint.slice(0, 8)
      const outputToken = Object.entries(MINT).find(([, v]) => v === swapParams.outputMint)?.[0] ?? swapParams.outputMint.slice(0, 8)
      const inputAmt    = swapParams.inputMint === MINT.SOL ? (swapParams.amount / 1e9).toFixed(4) : (swapParams.amount / 1e6).toFixed(2)
      const outputAmt   = swapParams.outputMint === MINT.SOL ? (parseInt(quote.outputAmount) / 1e9).toFixed(4) : (parseInt(quote.outputAmount) / 1e6).toFixed(2)

      return {
        intent: 'swap_quote',
        success: true,
        data: quote,
        message: [
          `💱 Swap Quote (via Jupiter)`,
          `  ${inputAmt} ${inputToken} → ${outputAmt} ${outputToken}`,
          `  Price Impact: ${quote.priceImpact.toFixed(2)}%`,
          `  Route: ${quote.route?.join(' → ') ?? 'Jupiter Aggregator'}`,
          '',
          `  To execute this swap, use the solana_swap tool.`,
        ].join('\n'),
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { intent: 'swap_quote', success: false, message: `Swap quote failed: ${message}` }
    }
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _agent: ClawPumpAgent | null = null

export function getClawPumpAgent(walletAddress?: string): ClawPumpAgent {
  const wallet = walletAddress ?? process.env.AGENT_WALLET_ADDRESS ?? '0xF66254F21a3e0F0E9C6fF7Ee096d8d1144A0dfCc'
  if (!_agent || walletAddress) {
    _agent = new ClawPumpAgent(wallet)
  }
  return _agent
}
