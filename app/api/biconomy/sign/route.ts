/**
 * POST /api/biconomy/sign
 *
 * Client-initiated UserOperation signing.
 * The frontend builds and sends a partially-signed UserOp
 * (with the user's wallet signature), and this route completes
 * the paymaster signature before forwarding to the bundler.
 *
 * Flow:
 *   1. Frontend: user connects wallet (Reown AppKit)
 *   2. Frontend: builds UserOp with user's signer
 *   3. Frontend: POST /api/biconomy/sign { userOp, chain }
 *   4. Server: adds paymaster signature (gasless sponsorship)
 *   5. Server: returns signed UserOp for frontend to submit to bundler
 *
 * Alternative (simpler) flow: use /api/biconomy/relay directly from
 * server-side code (Ralph agent, etc.) — no client involvement needed.
 *
 * Body:
 *   userOp: Partial<UserOperationStruct>
 *   chain?: SupportedChain
 *
 * Returns:
 *   { signedUserOp, paymasterAndData, chain }
 */

import { NextResponse } from 'next/server'
import { getBiconomyClient, SupportedChain, CHAIN_CONFIGS } from '@/lib/ethereum/biconomy'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userOp, chain = 'base' } = body as {
      userOp: Record<string, unknown>
      chain?: SupportedChain
    }

    if (!userOp) {
      return NextResponse.json({ error: 'userOp is required' }, { status: 400 })
    }

    if (!CHAIN_CONFIGS[chain]) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}` },
        { status: 400 }
      )
    }

    const client = await getBiconomyClient(chain)
    const smartAccount = (client as any).smartAccount

    // Get paymaster data for this UserOp (sponsorship).
    // The paymaster co-signs the op to indicate it will cover gas.
    const paymasterAndData = await smartAccount
      .getPaymasterAndData(userOp)
      .catch(() => '0x') // falls back to empty if paymaster call fails

    const signedUserOp = {
      ...userOp,
      paymasterAndData,
    }

    return NextResponse.json({
      signedUserOp,
      paymasterAndData,
      chain,
      smartAccountAddress: client.getAddress(),
      bundlerUrl: CHAIN_CONFIGS[chain].bundlerUrl,
    })

  } catch (error: unknown) {
    console.error('[/api/biconomy/sign] Error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}

/**
 * GET /api/biconomy/sign?chain=base
 * Returns the entrypoint address and bundler URL needed
 * for the client to construct a UserOp.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chain = (searchParams.get('chain') ?? 'base') as SupportedChain

  const config = CHAIN_CONFIGS[chain]
  if (!config) {
    return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 })
  }

  return NextResponse.json({
    chain,
    chainId:        config.chainId,
    bundlerUrl:     config.bundlerUrl,
    entrypoint:     '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // ERC-4337 entrypoint v0.6
    // The frontend uses these values to construct a UserOp before calling /sign
  })
}
