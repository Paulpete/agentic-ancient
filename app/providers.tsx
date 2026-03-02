'use client'

import { ReactNode } from 'react'
import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { mainnet, base, polygon, arbitrum } from '@reown/appkit/networks'
import { solana, solanaDevnet, solanaTestnet } from '@reown/appkit/networks'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets'

// ─── Project ID ───────────────────────────────────────────────────────────────
// Get yours free at https://cloud.reown.com
// Set NEXT_PUBLIC_REOWN_PROJECT_ID in your .env.local
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? 'YOUR_PROJECT_ID_FROM_CLOUD_REOWN_COM'

// ─── Networks ─────────────────────────────────────────────────────────────────
const networks = [mainnet, base, polygon, arbitrum, solana, solanaDevnet] as const

// ─── Wagmi adapter (EVM chains) ───────────────────────────────────────────────
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
})

// ─── Solana adapter ───────────────────────────────────────────────────────────
// Fixes the broken @reown/app-kit install attempt — correct package: @reown/appkit-adapter-solana
const solanaAdapter = new SolanaAdapter({
  wallets: [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
  ],
})

// ─── React Query ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient()

// ─── AppKit initialization ────────────────────────────────────────────────────
// createAppKit replaces the old WalletConnect modal + Wagmi provider setup.
// One call handles EVM (wagmi) + Solana simultaneously.
createAppKit({
  adapters: [wagmiAdapter, solanaAdapter],
  networks,
  projectId,
  metadata: {
    name: 'Empire Infinity Matrix',
    description: 'Agentic Ancient — Multi-chain Empire Dashboard',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://localhost:3000',
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  features: {
    analytics: true,
    email: false,
    socials: [],
    swaps: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#00ff41',           // Matrix green
    '--w3m-background-color': '#000000',
    '--w3m-font-family': 'monospace',
  },
})

// ─── Providers wrapper ────────────────────────────────────────────────────────
export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
