import { NextResponse } from 'next/server'
import { handleMcpRequest } from '@/lib/biconomy-mcp/client'

/**
 * GET /api/biconomy/mcp?q=gasless+transaction+base
 * POST /api/biconomy/mcp  { query: "..." }
 *
 * Proxies to Biconomy's public MCP server at https://docs.biconomy.io/mcp
 * Returns live SDK documentation for CryptoNaut to use when generating code.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? searchParams.get('query') ?? ''

  if (!query) {
    return NextResponse.json({ error: 'q param required' }, { status: 400 })
  }

  const result = await handleMcpRequest(query)
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const query = body.query ?? ''

  if (!query) {
    return NextResponse.json({ error: 'query field required' }, { status: 400 })
  }

  const result = await handleMcpRequest(query)
  return NextResponse.json(result)
}
