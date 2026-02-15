import { NextResponse } from 'next/server'
import { callProgram, invokeProgram } from '@/lib/solana/executor'

export async function POST(request: Request) {
  try {
    const { programId, instruction, args, data } = await request.json()
    
    const result = data 
      ? invokeProgram(programId, data)
      : callProgram(programId, instruction, args)
    
    return NextResponse.json({ result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
