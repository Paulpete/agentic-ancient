import { Connection, PublicKey } from '@solana/web3.js'

export async function getAllPrograms() {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY || process.env.HELIUS_API_KEY
  if (!apiKey) throw new Error('HELIUS_API_KEY required')
  
  const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`)
  
  const programs = await connection.getProgramAccounts(
    new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
    { filters: [{ dataSize: 36 }] }
  )
  
  const upgradable = []
  
  for (const p of programs) {
    const info = await connection.getAccountInfo(p.pubkey)
    if (info?.owner.toString() === 'BPFLoaderUpgradeab1e11111111111111111111111') {
      upgradable.push({
        address: p.pubkey.toString(),
        owner: info.owner.toString(),
        lamports: info.lamports,
        executable: info.executable
      })
    }
  }
  
  return upgradable
}
