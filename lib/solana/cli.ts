import { execSync } from 'child_process'

export function getUpgradablePrograms() {
  try {
    const output = execSync('solana program show --programs --url mainnet-beta', { 
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    })
    
    const programs = []
    const lines = output.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Program Id:')) {
        const programId = lines[i].split(':')[1]?.trim()
        const authorityLine = lines[i + 1]
        const authority = authorityLine?.includes('Upgrade Authority:') 
          ? authorityLine.split(':')[1]?.trim() 
          : 'none'
        
        if (programId && authority !== 'none') {
          programs.push({ programId, authority })
        }
      }
    }
    
    return programs
  } catch (error: any) {
    throw new Error(`Solana CLI error: ${error.message}`)
  }
}
