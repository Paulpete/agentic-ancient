import { NextResponse } from 'next/server'
import { getUpgradablePrograms } from '@/lib/solana/cli'

export async function GET() {
  try {
    const programs = getUpgradablePrograms()
    return NextResponse.json({ programs, count: programs.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
