'use client';

import React, { useState } from 'react';
import { IBundler, Bundler } from '@biconomy/bundler';
import { BiconomySmartAccountV2, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account";
import { ethers } from 'ethers';
import { ChainId } from "@biconomy/core-types";

export default function Home() {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ralphStatus, setRalphStatus] = useState<'stopped' | 'running'>('stopped');
  const [programs, setPrograms] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<string>('');

  const handleRalphLoop = async () => {
    const action = ralphStatus === 'stopped' ? 'POST' : 'DELETE'
    const res = await fetch('/api/ralph', { method: action })
    const data = await res.json()
    setRalphStatus(data.status === 'initiated' || data.status === 'already_running' ? 'running' : 'stopped')
  }

  const handleScanPrograms = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/programs')
      const data = await res.json()
      setPrograms(data.programs || [])
    } catch (error) {
      console.error(error)
    }
    setScanning(false)
  }

  const handleExecuteProgram = async () => {
    setExecuting(true)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: programs[0]?.programId,
          instruction: 'initialize',
          args: []
        })
      })
      const data = await res.json()
      setExecResult(data.result || data.error)
    } catch (error: any) {
      setExecResult(error.message)
    }
    setExecuting(false)
  }

  const handleSupertransaction = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const biconomySmartAccountConfig = {
        signer: signer,
        chainId: ChainId.BASE_GOERLI_TESTNET, // Base Goerli
        bundlerUrl: "https://bundler.biconomy.io/api/v2/84531/nJPK7B32G.7f948574-142f-456a-af40-53d35667b369", // From lib/ethereum/biconomy.ts
        biconomyPaymasterApiKey: "BICONOMY_API_KEY", // From lib/ethereum/biconomy.ts
      };

      const biconomySmartAccount = await BiconomySmartAccountV2.create(biconomySmartAccountConfig);

      const tx = {
        to: '0x322Af0da66D00be980C7aa006377FCaaEee34252',
        data: '0x',
        value: ethers.parseEther('0.001'),
      };

      const userOp = await biconomySmartAccount.buildUserOp([tx]);
      const userOpResponse = await biconomySmartAccount.sendUserOp(userOp);
      const { transactionHash } = await userOpResponse.waitForTxHash();
      
      setTxHash(transactionHash ?? null);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <main style={{ fontFamily: 'monospace', color: '#fff', backgroundColor: '#000', minHeight: '100vh', padding: '2rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', color: '#0f0' }}>EMPIRE INFINITY MATRIX</h1>
        <p style={{ color: '#888' }}>Helix Nexus Core Interface</p>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: '#0f0', marginBottom: '1rem' }}>// System Status: Nominal</p>
        <p style={{ color: '#0f0', marginBottom: '1rem' }}>// Awaiting your command, Guardian.</p>
        
        <div style={{ marginTop: '2rem', border: '1px solid #333', padding: '1.5rem' }}>
          <h2 style={{ color: '#0f0', borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Ralph Loop Control</h2>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>Autonomous agent execution system.</p>
          <button 
            onClick={handleRalphLoop}
            style={{ 
              backgroundColor: ralphStatus === 'running' ? '#f00' : '#0f0', 
              color: '#000', 
              border: 'none', 
              padding: '10px 20px', 
              cursor: 'pointer',
              fontSize: '1rem',
              marginRight: '1rem'
            }}
          >
            {ralphStatus === 'running' ? 'Stop Ralph Loop' : 'Initiate Ralph Loop'}
          </button>
          <button 
            onClick={handleScanPrograms}
            disabled={scanning}
            style={{ 
              backgroundColor: '#0f0', 
              color: '#000', 
              border: 'none', 
              padding: '10px 20px', 
              cursor: 'pointer',
              fontSize: '1rem',
              opacity: scanning ? 0.5 : 1
            }}
          >
            {scanning ? 'Scanning...' : 'Scan Programs'}
          </button>
          <div style={{ color: '#888', marginTop: '1rem' }}>Status: {ralphStatus}</div>
          {programs.length > 0 && (
            <div style={{ marginTop: '1rem', color: '#0f0' }}>
              <p>Upgradable Programs: {programs.length}</p>
              <button 
                onClick={handleExecuteProgram}
                disabled={executing}
                style={{ 
                  backgroundColor: '#0f0', 
                  color: '#000', 
                  border: 'none', 
                  padding: '5px 10px', 
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  marginTop: '0.5rem',
                  opacity: executing ? 0.5 : 1
                }}
              >
                {executing ? 'Executing...' : 'Execute First Program'}
              </button>
              {execResult && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#888' }}>
                  {execResult}
                </div>
              )}
              <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                {programs.slice(0, 10).map((p: any, i: number) => (
                  <div key={i} style={{ padding: '0.25rem', borderBottom: '1px solid #222' }}>
                    {p.programId}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '2rem', border: '1px solid #333', padding: '1.5rem' }}>
          <h2 style={{ color: '#0f0', borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Supertransaction Console</h2>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>Initiate gasless, multi-chain workflows.</p>
          <button 
            id="super-transaction-button"
            onClick={handleSupertransaction}
            disabled={loading}
            style={{ 
              backgroundColor: '#0f0', 
              color: '#000', 
              border: 'none', 
              padding: '10px 20px', 
              cursor: 'pointer',
              fontSize: '1rem',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Executing...' : 'Execute Supertransaction'}
          </button>
          {txHash && (
            <div style={{ marginTop: '1.5rem', color: '#0f0' }}>
              <p>Transaction successful!</p>
              <p>Transaction Hash: {txHash}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
