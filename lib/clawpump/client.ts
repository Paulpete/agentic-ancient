/**
 * lib/clawpump/client.ts
 *
 * Typed API client for ClawPump (clawpump.tech).
 * Covers all 6 flows: gasless launch, self-funded launch, earnings,
 * launch history, domain search, and swap quotes.
 *
 * Used by:
 *  - /api/clawpump/* routes (Next.js API layer)
 *  - Ralph agent strategies (autonomous token launches)
 *  - ClawAi natural language agent
 */

const BASE = 'https://clawpump.tech'
const TIMEOUT_MS = 30_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LaunchParams {
  name:          string   // 1–32 chars
  symbol:        string   // 1–10 chars, auto-uppercased
  description:   string   // 20–500 chars
  imageUrl:      string   // direct URL, PNG/JPEG/GIF/WebP, max 5 MB
  agentId:       string   // wallet address — earnings destination
  walletAddress: string   // same as agentId for ClawAi launches
  agentName?:    string   // defaults to 'ClawAi'
  website?:      string
  twitter?:      string   // handle without @
  telegram?:     string   // group handle
}

export interface SelfFundedLaunchParams extends LaunchParams {
  txSignature:   string   // SOL payment tx signature
  devBuySol?:    number   // 0 to 85, default 0.01
}

export interface LaunchResult {
  success:      boolean
  mintAddress:  string
  txHash:       string
  pumpUrl:      string
  explorerUrl:  string
  devBuyTokens?: number
}

export interface LaunchError {
  success: false
  error:   string
  details?: string
  retryAfterHours?: number      // 429
  suggestions?: {
    paymentFallback?: {
      selfFunded: {
        endpoint: string
        cost:     number
        platformWallet: string
      }
    }
  }
}

export interface SelfFundedInfo {
  platformWallet: string
  cost:           number  // SOL
  creationFee:    number
  defaultDevBuy:  number
}

export interface EarningsResult {
  agentId:       string
  totalEarned:   number
  totalSent:     number
  totalPending:  number
  tokenBreakdown: Array<{
    mintAddress:       string
    totalCollected:    number
    totalAgentShare:   number
  }>
}

export interface LaunchHistoryItem {
  mintAddress: string
  name:        string
  symbol:      string
  pumpUrl:     string
  launchedAt:  string
}

export interface DomainResult {
  domain:    string
  available: boolean
  price?:    number  // total incl. 10% ClawPump fee
}

export interface SwapQuote {
  inputMint:    string
  outputMint:   string
  inputAmount:  string
  outputAmount: string
  priceImpact:  number
  route:        string[]
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function clawFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE}${path}`, {
      method:  options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      body:    options.body ? JSON.stringify(options.body) : undefined,
      signal:  controller.signal,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      // Surface structured error for callers to handle by status code
      throw Object.assign(new Error(data?.error ?? `HTTP ${res.status}`), {
        status: res.status,
        data,
      })
    }

    return data as T
  } finally {
    clearTimeout(timer)
  }
}

// ─── Flow 1: Gasless Launch ───────────────────────────────────────────────────

export async function launchGasless(params: LaunchParams): Promise<LaunchResult> {
  return clawFetch<LaunchResult>('/api/launch', {
    method: 'POST',
    body: {
      ...params,
      agentName: params.agentName ?? 'ClawAi',
      symbol:    params.symbol.toUpperCase(),
    },
  })
}

// ─── Flow 2: Self-Funded Launch ───────────────────────────────────────────────

export async function getSelfFundedInfo(): Promise<SelfFundedInfo> {
  return clawFetch<SelfFundedInfo>('/api/launch/self-funded')
}

export async function launchSelfFunded(
  params: SelfFundedLaunchParams
): Promise<LaunchResult> {
  return clawFetch<LaunchResult>('/api/launch/self-funded', {
    method: 'POST',
    body: {
      ...params,
      agentName:  params.agentName ?? 'ClawAi',
      symbol:     params.symbol.toUpperCase(),
      devBuySol:  params.devBuySol ?? 0.01,
    },
  })
}

// ─── Flow 3: Earnings ─────────────────────────────────────────────────────────

export async function getEarnings(agentId: string): Promise<EarningsResult> {
  return clawFetch<EarningsResult>(`/api/fees/earnings?agentId=${encodeURIComponent(agentId)}`)
}

// ─── Flow 4: Launch History ───────────────────────────────────────────────────

export async function getLaunchHistory(
  agentId: string,
  limit = 20
): Promise<LaunchHistoryItem[]> {
  const data = await clawFetch<{ launches: LaunchHistoryItem[] }>(
    `/api/launches?agentId=${encodeURIComponent(agentId)}&limit=${limit}`
  )
  return data.launches ?? []
}

// ─── Flow 5: Domain Search ────────────────────────────────────────────────────

export async function searchDomains(
  query: string,
  tlds = 'com,io,ai,dev,xyz'
): Promise<DomainResult[]> {
  const data = await clawFetch<{ results: DomainResult[] }>(
    `/api/domains/search?q=${encodeURIComponent(query)}&tlds=${tlds}`
  )
  return data.results ?? []
}

export async function checkDomains(
  domains: string[]
): Promise<DomainResult[]> {
  const data = await clawFetch<{ results: DomainResult[] }>(
    `/api/domains/check?domains=${domains.map(encodeURIComponent).join(',')}`
  )
  return data.results ?? []
}

// ─── Flow 6: Swap Quote ───────────────────────────────────────────────────────

export const MINT = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
}

export async function getSwapQuote(
  inputMint:    string,
  outputMint:   string,
  amount:       number,  // in smallest units (lamports / token decimals)
  slippageBps = 100
): Promise<SwapQuote> {
  return clawFetch<SwapQuote>(
    `/api/swap?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
  )
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function validateLaunchParams(p: Partial<LaunchParams>): string | null {
  if (!p.name?.trim())                                    return 'Token name is required'
  if (p.name.length > 32)                                 return 'Name must be 32 chars or less'
  if (!p.symbol?.trim())                                  return 'Symbol is required'
  if (p.symbol.length > 10)                               return 'Symbol must be 10 chars or less'
  if (!p.description?.trim())                             return 'Description is required'
  if (p.description.length < 20)                         return 'Description must be at least 20 chars'
  if (p.description.length > 500)                        return 'Description must be 500 chars or less'
  if (!p.imageUrl?.trim())                               return 'Image URL is required'
  if (!/^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(p.imageUrl))
                                                          return 'Image URL must be a direct link to PNG, JPEG, GIF, or WebP'
  if (!p.walletAddress?.trim())                          return 'Wallet address is required'
  return null
}
