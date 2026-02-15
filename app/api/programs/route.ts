import { NextResponse } from 'next/server'
import { getAllPrograms } from '@/lib/helius/programs'

export async function GET() {
  try {
    const programs = await getAllPrograms()
    return NextResponse.json({ programs, count: programs.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
