import { NextResponse } from 'next/server'
import { RalphLoop } from '@/lib/ralph/loop'

let loopInstance: RalphLoop | null = null

export async function POST() {
  if (loopInstance) {
    return NextResponse.json({ status: 'already_running' })
  }
  
  loopInstance = new RalphLoop()
  loopInstance.start().catch(console.error)
  
  return NextResponse.json({ status: 'initiated', message: 'Ralph Loop started' })
}

export async function DELETE() {
  if (!loopInstance) {
    return NextResponse.json({ status: 'not_running' })
  }
  
  loopInstance.stop()
  loopInstance = null
  
  return NextResponse.json({ status: 'stopped' })
}

export async function GET() {
  return NextResponse.json({ 
    status: loopInstance ? 'running' : 'stopped' 
  })
}
