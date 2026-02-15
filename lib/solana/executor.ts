import { execSync } from 'child_process'

export function callProgram(programId: string, instruction: string, args: string[] = []) {
  const cmd = `solana program call ${programId} ${instruction} ${args.join(' ')} --url mainnet-beta`
  return execSync(cmd, { encoding: 'utf-8' })
}

export function invokeProgram(programId: string, data: string) {
  const cmd = `solana program invoke ${programId} --data ${data} --url mainnet-beta`
  return execSync(cmd, { encoding: 'utf-8' })
}
