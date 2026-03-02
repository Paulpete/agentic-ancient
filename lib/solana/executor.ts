import { execSync } from 'child_process'

// ─── Input validation ──────────────────────────────────────────────────────
// FIX: CRITICAL shell injection — programId/data/args were passed raw into execSync.
// Validate all inputs against strict allowlists before any shell invocation.

const BASE58_RE    = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const INSTR_RE     = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/
const ARG_RE       = /^[a-zA-Z0-9_\-.]{1,128}$/
const HEX_DATA_RE  = /^(0x)?[0-9a-fA-F]{0,4096}$/

function assertBase58(val: string, field: string) {
  if (!BASE58_RE.test(val)) throw new Error(`Invalid ${field}: must be a base58 public key`)
}

function assertInstruction(val: string) {
  if (!INSTR_RE.test(val)) throw new Error('Invalid instruction: alphanumeric and underscores only')
}

function assertArg(val: string, idx: number) {
  if (!ARG_RE.test(val)) throw new Error(`Invalid arg[${idx}]: contains unsafe characters`)
}

function assertHexData(val: string) {
  if (!HEX_DATA_RE.test(val)) throw new Error('Invalid data: must be hex-encoded bytes')
}

// ─── Program interaction ───────────────────────────────────────────────────

export function callProgram(
  programId: string,
  instruction: string,
  args: string[] = []
) {
  // Validate all inputs before shell execution
  assertBase58(programId, 'programId')
  assertInstruction(instruction)
  args.forEach((a, i) => assertArg(a, i))
  if (args.length > 32) throw new Error('Too many args (max 32)')

  // Build command with validated, individually-escaped arguments
  // execSync receives an array-style string — each part validated above
  const safeArgs = args.map(a => `'${a}'`).join(' ')
  const cmd = `solana program call '${programId}' '${instruction}' ${safeArgs} --url mainnet-beta`
  return execSync(cmd, { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 })
}

export function invokeProgram(programId: string, data: string) {
  assertBase58(programId, 'programId')
  assertHexData(data)

  const cmd = `solana program invoke '${programId}' --data '${data}' --url mainnet-beta`
  return execSync(cmd, { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 })
}
