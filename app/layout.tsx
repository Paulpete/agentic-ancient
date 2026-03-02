import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Empire Infinity Matrix',
  description: 'Agentic Ancient — Autonomous Multi-Chain Empire',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', fontFamily: 'monospace' }}>
        {/* 
          Providers wraps the full app with:
          - WagmiProvider (EVM chains: mainnet, base, polygon, arbitrum)
          - SolanaAdapter (Phantom, Solflare, Backpack)
          - QueryClientProvider (react-query for wagmi hooks)
          - AppKit modal (createAppKit called in providers.tsx)
        */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
