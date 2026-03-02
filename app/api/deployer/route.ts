import { NextResponse } from 'next/server'

/**
 * /api/deployer
 * 
 * REST interface to the CryptoGene Devs Co Deployer (cryptogene_deployer.ts).
 * Executes gasless and multichain transactions on the Guardian's behalf via
 * Biconomy MEE AbstractJS.
 * 
 * GET  /api/deployer          → smart account addresses on all chains
 * POST /api/deployer          → execute action (send | deploy | supertransaction | signal)
 */

export async function GET() {
  try {
    const { handleDeployerRequest } = await import('@/cryptogene_deployer')
    const result = await handleDeployerRequest('GET', {})
    return NextResponse.json(result.data, { status: result.status })
  } catch (err: any) {
    // Return graceful response if ETH_PRIVATE_KEY not set
    return NextResponse.json({
      label: 'CryptoGene Devs Co',
      status: 'deployer_ready',
      note: 'Set ETH_PRIVATE_KEY and BICONOMY_API_KEY in .env.local to activate',
      actions: ['send', 'deploy', 'supertransaction', 'deploy_multichain', 'signal'],
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const validActions = ['send', 'deploy', 'supertransaction', 'deploy_multichain', 'signal']
    if (!validActions.includes(body.action)) {
      return NextResponse.json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`
      }, { status: 400 })
    }

    const { handleDeployerRequest } = await import('@/cryptogene_deployer')
    const result = await handleDeployerRequest('POST', body)
    return NextResponse.json(result.data, { status: result.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
