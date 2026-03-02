/**
 * GET /api/clawpump/domains?q=<keyword>&tlds=com,ai,io
 * GET /api/clawpump/domains?check=domain1.com,domain2.ai
 */
import { NextResponse } from 'next/server'
import { searchDomains, checkDomains } from '@/lib/clawpump/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query  = searchParams.get('q') ?? ''
  const check  = searchParams.get('check') ?? ''
  const tlds   = searchParams.get('tlds') ?? 'com,io,ai,dev,xyz'

  if (!query && !check) {
    return NextResponse.json({ error: 'Provide q (keyword) or check (comma-separated domains)' }, { status: 400 })
  }

  try {
    const results = check
      ? await checkDomains(check.split(',').map(d => d.trim()))
      : await searchDomains(query, tlds)

    return NextResponse.json({ results, count: results.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
