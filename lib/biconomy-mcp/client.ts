/**
 * lib/biconomy-mcp/client.ts
 *
 * Biconomy MCP (Model Context Protocol) client.
 * Queries https://docs.biconomy.io/mcp for live SDK guidance —
 * used by CryptoNaut to generate correct gasless transaction code
 * without hardcoding outdated SDK patterns.
 */

const MCP_URL = 'https://docs.biconomy.io/mcp'

export interface McpSearchResult {
  title?: string
  content: string
  url?: string
}

export interface McpResponse {
  results: McpSearchResult[]
  raw: string
  ok: boolean
}

async function mcpCall(query: string): Promise<McpResponse> {
  try {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'SearchBiconomyDocs',
        arguments: { query },
      },
    }

    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // No auth needed — Biconomy MCP is public
    })

    if (!res.ok) {
      return { results: [], raw: '', ok: false }
    }

    const data = await res.json()
    const content = data?.result?.content ?? []

    const results: McpSearchResult[] = content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => ({
        content: c.text ?? '',
        title: c.title,
        url: c.url,
      }))

    const raw = results.map(r => r.content).join('\n\n')
    return { results, raw, ok: true }

  } catch (e) {
    console.error('[BiconomyMCP] fetch failed:', e)
    return { results: [], raw: '', ok: false }
  }
}

// ─── Named query helpers ───────────────────────────────────────────────────

/** Get setup guide for Nexus smart account */
export async function getSmartAccountSetup(): Promise<string> {
  const r = await mcpCall('create Nexus smart account TypeScript quickstart bundler')
  return r.raw
}

/** Get gasless transaction guide */
export async function getGaslessGuide(chain = 'base'): Promise<string> {
  const r = await mcpCall(`send gasless transaction ${chain} paymaster userOp`)
  return r.raw
}

/** Get bundler + paymaster config for a chain */
export async function getBundlerConfig(chainId: number): Promise<string> {
  const chainName = {8453: 'base', 137: 'polygon', 1: 'mainnet', 80001: 'mumbai'}[chainId] ?? 'base'
  const r = await mcpCall(`bundler paymaster URL config ${chainName} chainId ${chainId}`)
  return r.raw
}

/** Get latest SDK version / installation instructions */
export async function getSdkInstall(): Promise<string> {
  const r = await mcpCall('install npm @biconomy/abstractjs nexus package version')
  return r.raw
}

/** Generic search — used by CryptoNaut for dynamic lookups */
export async function searchBiconomyDocs(query: string): Promise<McpResponse> {
  return mcpCall(query)
}

// ─── API route helper ──────────────────────────────────────────────────────
// Used by /api/biconomy/mcp route to proxy requests from the frontend

export async function handleMcpRequest(query: string): Promise<{
  query: string
  raw: string
  results: McpSearchResult[]
  ok: boolean
  timestamp: string
}> {
  const result = await mcpCall(query)
  return {
    query,
    ...result,
    timestamp: new Date().toISOString(),
  }
}
