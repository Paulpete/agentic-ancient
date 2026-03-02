'use client'

import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'

const S = {
  panel: {
    border: '1px solid #333',
    padding: '1.5rem',
    marginTop: '2rem',
    background: '#0a0a0a',
  } as React.CSSProperties,
  header: {
    color: '#00ff41',
    borderBottom: '1px solid #333',
    paddingBottom: '0.5rem',
    marginBottom: '1rem',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  connectBtn: {
    backgroundColor: '#00ff41',
    color: '#000',
    border: 'none',
    padding: '10px 24px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontFamily: 'monospace',
    fontWeight: 700,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  disconnectBtn: {
    backgroundColor: 'transparent',
    color: '#ff4141',
    border: '1px solid #ff4141',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    marginLeft: '1rem',
  } as React.CSSProperties,
  networkBtn: {
    backgroundColor: 'transparent',
    color: '#00ff41',
    border: '1px solid #333',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    marginLeft: '0.5rem',
  } as React.CSSProperties,
  address: {
    color: '#00ff41',
    fontSize: '0.85rem',
    background: '#111',
    padding: '8px 12px',
    marginTop: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  label: { color: '#555', fontSize: '0.75rem' },
  value: { color: '#00ff41' },
  status: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: '0.4rem',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    marginTop: '0.75rem',
  } as React.CSSProperties,
  stat: {
    background: '#111',
    padding: '8px 12px',
    fontSize: '0.75rem',
  } as React.CSSProperties,
}

export default function WalletPanel() {
  // AppKit hooks — the core of the Reown fix.
  // useAppKit() gives open() to trigger the connection modal.
  // useAppKitAccount() gives address, isConnected, status.
  // useAppKitNetwork() gives the active chain name.
  const { open } = useAppKit()
  const { address, isConnected, status, embeddedWalletInfo } = useAppKitAccount()
  const { caipNetwork, chainId } = useAppKitNetwork()

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  const statusColor = {
    connected: '#00ff41',
    connecting: '#ffaa00',
    disconnected: '#ff4141',
    reconnecting: '#ffaa00',
  }[status ?? 'disconnected'] ?? '#555'

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span>🔐</span> Wallet Interface
        {isConnected && (
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#555' }}>
            {caipNetwork?.name ?? 'Unknown Chain'}
          </span>
        )}
      </div>

      {!isConnected ? (
        <>
          <p style={{ color: '#555', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
            Connect Phantom, Solflare, MetaMask, Coinbase or any WalletConnect wallet.
            Supports EVM (Base, Ethereum, Polygon) and Solana simultaneously.
          </p>
          {/* 
            open() with no args opens the full AppKit modal.
            open({ view: 'Networks' }) jumps straight to network select.
            open({ view: 'Account' }) opens account details.
          */}
          <button style={S.connectBtn} onClick={() => open()}>
            ▶ Connect Wallet
          </button>
        </>
      ) : (
        <>
          <div style={S.address}>
            <span
              style={{ ...S.status, background: statusColor }}
              title={`Status: ${status}`}
            />
            <span style={S.label}>Address:</span>
            <span style={S.value}>{shortAddr}</span>
            <button style={S.networkBtn} onClick={() => open({ view: 'Networks' })}>
              Switch Chain
            </button>
            <button style={S.disconnectBtn} onClick={() => open({ view: 'Account' })}>
              Account ↗
            </button>
          </div>

          <div style={S.grid}>
            <div style={S.stat}>
              <div style={{ color: '#555', marginBottom: '2px' }}>Chain</div>
              <div style={{ color: '#00ff41' }}>{caipNetwork?.name ?? '—'}</div>
            </div>
            <div style={S.stat}>
              <div style={{ color: '#555', marginBottom: '2px' }}>Chain ID</div>
              <div style={{ color: '#00ff41' }}>{chainId ?? '—'}</div>
            </div>
            <div style={S.stat}>
              <div style={{ color: '#555', marginBottom: '2px' }}>Status</div>
              <div style={{ color: statusColor }}>{status}</div>
            </div>
            <div style={S.stat}>
              <div style={{ color: '#555', marginBottom: '2px' }}>Type</div>
              <div style={{ color: '#00ff41' }}>
                {embeddedWalletInfo?.authProvider ?? 'External'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
