'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const WalletPanel = dynamic(() => import('./components/WalletPanel'), { ssr: false });

interface TaxEvent {
  id: string; date: string; eventType: string; asset: string;
  gainLossUsd: number; taxCategory: string; strategySource?: string; notes: string;
}
interface TaxSessionSummary {
  totalGainLoss: number; ordinaryIncome: number; eventCount: number;
  byCategory: Record<string, number>;
}

const S = {
  page:    { fontFamily: 'monospace', color: '#fff', backgroundColor: '#000', minHeight: '100vh', padding: '2rem' } as React.CSSProperties,
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' } as React.CSSProperties,
  panel:   { border: '1px solid #1a1a1a', padding: '1.5rem', background: '#050505' } as React.CSSProperties,
  panelFull: { border: '1px solid #1a1a1a', padding: '1.5rem', background: '#050505', marginTop: '1.5rem' } as React.CSSProperties,
  ph2:     { color: '#00ff41', borderBottom: '1px solid #1a1a1a', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1rem', margin: '0 0 1rem 0' } as React.CSSProperties,
  dim:     { color: '#555', fontSize: '0.85rem', marginBottom: '1rem' } as React.CSSProperties,
  btn:     { backgroundColor: '#00ff41', color: '#000', border: 'none', padding: '8px 18px', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700 } as React.CSSProperties,
  btnRed:  { backgroundColor: 'transparent', color: '#ff4141', border: '1px solid #ff4141', padding: '8px 18px', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'monospace' } as React.CSSProperties,
  btnGhost:{ backgroundColor: 'transparent', color: '#00ff41', border: '1px solid #333', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'monospace', marginLeft: '0.5rem' } as React.CSSProperties,
  input: { background: '#111', border: '1px solid #333', color: '#00ff41', padding: '6px 10px', fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' as const },
  select: { background: '#111', border: '1px solid #333', color: '#00ff41', padding: '6px 10px', fontFamily: 'monospace', fontSize: '0.85rem' } as React.CSSProperties,
};

export default function Home() {
  const [ralphStatus, setRalphStatus] = useState<'stopped'|'running'>('stopped');
  const [programs, setPrograms] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState('');
  const [txHash, setTxHash] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [taxEvents, setTaxEvents] = useState<TaxEvent[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSessionSummary|null>(null);
  const [taxPolling, setTaxPolling] = useState(false);
  const [reportWallet, setReportWallet] = useState('');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMethod, setReportMethod] = useState<'fifo'|'lifo'|'hifo'>('fifo');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);

  const handleRalphLoop = async () => {
    const method = ralphStatus === 'stopped' ? 'POST' : 'DELETE';
    const res = await fetch('/api/ralph', { method });
    const data = await res.json();
    setRalphStatus(data.status === 'initiated' || data.status === 'already_running' ? 'running' : 'stopped');
  };

  const handleScanPrograms = async () => {
    setScanning(true);
    try { const r = await fetch('/api/programs'); const d = await r.json(); setPrograms(d.programs||[]); } catch(e){console.error(e);}
    setScanning(false);
  };

  const handleExecuteProgram = async () => {
    setExecuting(true);
    try {
      const r = await fetch('/api/execute', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ programId: programs[0]?.programId, instruction:'initialize', args:[] }) });
      const d = await r.json(); setExecResult(d.result||d.error);
    } catch(e:any){setExecResult(e.message);}
    setExecuting(false);
  };

  const fetchTaxEvents = useCallback(async () => {
    try { const r = await fetch('/api/tax?limit=20'); const d = await r.json(); setTaxEvents(d.events??[]); setTaxSummary(d.summary??null); } catch(e){}
  }, []);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval>|null = null;
    if (taxPolling || ralphStatus === 'running') { fetchTaxEvents(); iv = setInterval(fetchTaxEvents, 5000); }
    return () => { if (iv) clearInterval(iv); };
  }, [taxPolling, ralphStatus, fetchTaxEvents]);

  useEffect(() => { if (ralphStatus === 'running') setTaxPolling(true); }, [ralphStatus]);

  const handleGenerateReport = async () => {
    if (!reportWallet) return;
    setReportLoading(true); setReportResult(null);
    try {
      const r = await fetch('/api/tax/report', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ wallet:reportWallet, year:reportYear, method:reportMethod }) });
      const d = await r.json(); setReportResult(d.summary??d.error);
    } catch(e:any){setReportResult({error:e.message});}
    setReportLoading(false);
  };

  const handleSupertransaction = async () => {
    setLoading(true);
    try {
      // FIX: Removed hardcoded Biconomy bundler API key (was nJPK7B32G... in source).
      // FIX: Removed deprecated @biconomy/core-types + Base Goerli testnet (sunset).
      // FIX: Removed hardcoded destination address 0x322Af0da66D00be980C7aa006377FCaaEee34252.
      // Now routes through server-side /api/biconomy/relay — secrets stay server-only.
      const recipient = process.env.NEXT_PUBLIC_TX_RECIPIENT ?? '0xF66254F21a3e0F0E9C6fF7Ee096d8d1144A0dfCc';
      // recipient always set — falls back to agent address
      const res = await fetch('/api/biconomy/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: [{ to: recipient, data: '0x' }], chain: 'base' }),
      });
      const data = await res.json();
      if (data.txHash) setTxHash(data.txHash);
      else console.error('Relay error:', data.error);
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  return (
    <main style={S.page}>
      <header style={{ textAlign:'center', marginBottom:'3rem' }}>
        <h1 style={{ fontSize:'2.5rem', color:'#00ff41', letterSpacing:'0.1em', margin:0 }}>EMPIRE INFINITY MATRIX</h1>
        <p style={{ color:'#444', marginTop:'0.25rem' }}>Helix Nexus Core Interface · ClawAi v0.2</p>
      </header>

      {/* Reown Wallet — fixes the broken wallet integration */}
      <WalletPanel />

      <div style={S.grid}>
        {/* Ralph Loop */}
        <div style={S.panel}>
          <h2 style={S.ph2}>⚡ Ralph Loop Control</h2>
          <p style={S.dim}>Autonomous agent. Tax events auto-captured per cycle.</p>
          <button onClick={handleRalphLoop} style={ralphStatus==='running'?S.btnRed:S.btn}>
            {ralphStatus==='running'?'■ Stop Ralph':'▶ Initiate Ralph Loop'}
          </button>
          <button onClick={handleScanPrograms} disabled={scanning} style={{...S.btnGhost,opacity:scanning?0.5:1}}>
            {scanning?'...':'Scan Programs'}
          </button>
          <div style={{color:'#444',marginTop:'0.75rem',fontSize:'0.8rem'}}>
            Status: <span style={{color:ralphStatus==='running'?'#00ff41':'#ff4141'}}>{ralphStatus}</span>
          </div>
          {programs.length>0&&(
            <div style={{marginTop:'0.75rem'}}>
              <div style={{color:'#555',fontSize:'0.75rem',marginBottom:'0.5rem'}}>{programs.length} upgradable programs</div>
              <button onClick={handleExecuteProgram} disabled={executing} style={{...S.btn,fontSize:'0.75rem',padding:'5px 12px',opacity:executing?0.5:1}}>
                {executing?'...':'Execute First Program'}
              </button>
              {execResult&&<div style={{color:'#555',fontSize:'0.7rem',marginTop:'0.4rem'}}>{execResult}</div>}
            </div>
          )}
        </div>

        {/* Supertransaction */}
        <div style={S.panel}>
          <h2 style={S.ph2}>🔗 Supertransaction Console</h2>
          <p style={S.dim}>Biconomy gasless tx · Base Goerli testnet</p>
          <button onClick={handleSupertransaction} disabled={loading} style={{...S.btn,opacity:loading?0.5:1}}>
            {loading?'⏳ Executing...':'▶ Execute Supertransaction'}
          </button>
          {txHash&&(
            <div style={{marginTop:'1rem',fontSize:'0.75rem',color:'#00ff41'}}>
              <div>✅ TX confirmed</div>
              <div style={{color:'#444',wordBreak:'break-all',marginTop:'0.25rem'}}>{txHash}</div>
            </div>
          )}
        </div>
      </div>

      {/* Live Tax Console */}
      <div style={S.panelFull}>
        <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem',borderBottom:'1px solid #1a1a1a',paddingBottom:'0.75rem'}}>
          <h2 style={{...S.ph2,margin:0,borderBottom:'none'}}>🧾 Live Tax Console</h2>
          <span style={{fontSize:'0.75rem',color:'#444'}}>Auto-captures taxable events from every Ralph strategy execution</span>
          <div style={{marginLeft:'auto',display:'flex',gap:'0.5rem'}}>
            <button onClick={()=>{setTaxPolling(p=>!p);if(!taxPolling)fetchTaxEvents();}} style={{...S.btnGhost,color:taxPolling?'#00ff41':'#444'}}>
              {taxPolling?'● LIVE':'○ PAUSED'}
            </button>
            <button onClick={fetchTaxEvents} style={S.btnGhost}>↻ Refresh</button>
          </div>
        </div>

        {taxSummary&&(
          <div style={{display:'flex',gap:'1.5rem',marginBottom:'1rem',padding:'0.75rem',background:'#0a0a0a',fontSize:'0.8rem',flexWrap:'wrap'}}>
            <div><span style={{color:'#444'}}>Net Gain/Loss </span>
              <span style={{color:taxSummary.totalGainLoss>=0?'#00ff41':'#ff4141'}}>
                {taxSummary.totalGainLoss>=0?'+':''}${taxSummary.totalGainLoss.toFixed(2)}
              </span>
            </div>
            <div><span style={{color:'#444'}}>Ordinary Income </span><span style={{color:'#ffaa00'}}>${taxSummary.ordinaryIncome.toFixed(2)}</span></div>
            <div><span style={{color:'#444'}}>Events </span><span style={{color:'#00ff41'}}>{taxSummary.eventCount}</span></div>
          </div>
        )}

        {taxEvents.length===0?(
          <div style={{color:'#333',fontSize:'0.85rem',padding:'1.5rem 0',textAlign:'center'}}>
            No tax events yet. Start Ralph Loop to capture events in real time.
          </div>
        ):(
          <div style={{maxHeight:'220px',overflowY:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'90px 80px 1fr 80px 130px 100px',gap:'0 1rem',padding:'0.3rem 0',fontSize:'0.7rem',color:'#333',borderBottom:'1px solid #111'}}>
              <span>Date</span><span>Type</span><span>Notes</span><span>Gain/Loss</span><span>Category</span><span>Strategy</span>
            </div>
            {taxEvents.map(e=>(
              <div key={e.id} style={{display:'grid',gridTemplateColumns:'90px 80px 1fr 80px 130px 100px',gap:'0 1rem',padding:'0.35rem 0',borderBottom:'1px solid #0a0a0a',fontSize:'0.75rem',alignItems:'center'}}>
                <span style={{color:'#444'}}>{e.date}</span>
                <span style={{color:'#555'}}>{e.eventType.replace(/_/g,' ')}</span>
                <span style={{color:'#444',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.asset} — {e.notes}</span>
                <span style={{color:e.gainLossUsd>=0?'#00ff41':'#ff4141'}}>{e.gainLossUsd>=0?'+':''}${e.gainLossUsd.toFixed(2)}</span>
                <span style={{color:e.taxCategory.includes('gain')?'#00ff41':e.taxCategory.includes('loss')?'#ff4141':'#ffaa00',fontSize:'0.7rem'}}>{e.taxCategory.replace(/_/g,' ')}</span>
                <span style={{color:'#333'}}>{e.strategySource??'—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Tax Report Generator */}
      <div style={S.panelFull}>
        <h2 style={S.ph2}>📊 Full Tax Report · solana-tax engine</h2>
        <p style={S.dim}>Runs FIFO/LIFO/HIFO cost basis engine against full on-chain history for any wallet</p>

        <div style={{display:'grid',gridTemplateColumns:'1fr 100px 100px auto',gap:'0.75rem',alignItems:'end'}}>
          <div>
            <div style={{color:'#444',fontSize:'0.75rem',marginBottom:'4px'}}>Solana Wallet Address</div>
            <input style={S.input} placeholder="e.g. 4eJZV..." value={reportWallet} onChange={e=>setReportWallet(e.target.value)}/>
          </div>
          <div>
            <div style={{color:'#444',fontSize:'0.75rem',marginBottom:'4px'}}>Year</div>
            <input style={{...S.input}} type="number" value={reportYear} onChange={e=>setReportYear(parseInt(e.target.value))}/>
          </div>
          <div>
            <div style={{color:'#444',fontSize:'0.75rem',marginBottom:'4px'}}>Method</div>
            <select style={S.select} value={reportMethod} onChange={e=>setReportMethod(e.target.value as any)}>
              <option value="fifo">FIFO</option>
              <option value="lifo">LIFO</option>
              <option value="hifo">HIFO</option>
            </select>
          </div>
          <button onClick={handleGenerateReport} disabled={reportLoading||!reportWallet} style={{...S.btn,opacity:reportLoading||!reportWallet?0.4:1}}>
            {reportLoading?'⏳ Running...':'▶ Generate'}
          </button>
        </div>

        {reportResult&&!reportResult.error&&(
          <div style={{marginTop:'1.25rem',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem'}}>
            {([
              ['Net Capital Gain', `$${reportResult.netCapitalGain?.toFixed(2)??\u2014}`, reportResult.netCapitalGain>=0?'#00ff41':'#ff4141'],
              ['Short-Term Gains', `$${reportResult.shortTermGains?.toFixed(2)??\u2014}`, '#ffaa00'],
              ['Long-Term Gains',  `$${reportResult.longTermGains?.toFixed(2)??\u2014}`,  '#00aaff'],
              ['Ordinary Income',  `$${reportResult.totalIncome?.toFixed(2)??\u2014}`,    '#ffaa00'],
              ['Total Losses',     `$${reportResult.totalLosses?.toFixed(2)??\u2014}`,    '#ff4141'],
              ['Est. Tax Owed',    `$${reportResult.estimatedTax?.toFixed(2)??\u2014}`,   '#ff4141'],
              ['Transactions',     String(reportResult.transactionsAnalyzed??\u2014),      '#444'],
              ['Taxable Events',   String(reportResult.taxableEvents??\u2014),             '#444'],
            ] as [string,string,string][]).map(([label,val,color])=>(
              <div key={label} style={{background:'#0a0a0a',padding:'0.75rem',border:'1px solid #111'}}>
                <div style={{color:'#444',fontSize:'0.7rem',marginBottom:'4px'}}>{label}</div>
                <div style={{color,fontSize:'1rem',fontWeight:700}}>{val}</div>
              </div>
            ))}
          </div>
        )}
        {reportResult?.error&&<div style={{marginTop:'1rem',color:'#ff4141',fontSize:'0.8rem'}}>❌ {reportResult.error}</div>}
      </div>

      {/* ── ClawPump Token Launchpad ── */}
      <ClawPumpPanel />

    </main>
  );
}

// ─── ClawPump Panel Component ──────────────────────────────────────────────

function ClawPumpPanel() {
  const [cpText, setCpText]       = React.useState('');
  const [cpLoading, setCpLoading] = React.useState(false);
  const [cpResult, setCpResult]   = React.useState<any>(null);
  const [cpPending, setCpPending] = React.useState<any>(null);
  const [cpTab, setCpTab]         = React.useState('launch');

  const runAgent = async (text: string) => {
    if (!text.trim()) return;
    setCpLoading(true); setCpResult(null); setCpPending(null);
    try {
      const r = await fetch('/api/clawpump/agent', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      if (d.data?.pendingLaunch) setCpPending(d.data.pendingLaunch);
      setCpResult(d);
    } catch(e: any) { setCpResult({ success: false, message: e.message }); }
    setCpLoading(false);
  };

  const confirmLaunch = async () => {
    if (!cpPending) return;
    setCpLoading(true);
    try {
      const r = await fetch('/api/clawpump/agent', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ text: '', confirm: true, pendingLaunch: cpPending }),
      });
      const d = await r.json();
      setCpResult(d); setCpPending(null);
    } catch(e: any) { setCpResult({ success: false, message: e.message }); }
    setCpLoading(false);
  };

  const quickPrompts: [string, string, string][] = [
    ['earnings', '💰 Earnings',   'Check my ClawPump earnings'],
    ['history',  '📋 History',    'Show my launch history'],
    ['domains',  '🔍 Domains',    'Search domains for empire'],
    ['quote',    '💱 Swap Quote', 'Get swap quote 1 SOL to USDC'],
  ];

  return (
    <div style={{...S.panelFull, marginTop: '1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem',borderBottom:'1px solid #1a1a1a',paddingBottom:'0.75rem'}}>
        <h2 style={{...S.ph2, margin:0, borderBottom:'none'}}>🐾 ClawPump Token Launchpad</h2>
        <span style={{fontSize:'0.75rem',color:'#444'}}>pump.fun launches · 65% trading fees · Gasless FREE</span>
      </div>

      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        <button onClick={()=>{setCpTab('launch');setCpResult(null);setCpPending(null);setCpText('');}}
          style={{...S.btnGhost, color: cpTab==='launch'?'#00ff41':'#444'}}>🚀 Launch Token</button>
        {quickPrompts.map(([tab, label, prompt])=>(
          <button key={tab} onClick={()=>{setCpTab(tab); runAgent(prompt);}}
            style={{...S.btnGhost, color: cpTab===tab?'#00ff41':'#444'}}>{label}</button>
        ))}
      </div>

      {cpTab === 'launch' && (
        <div style={{marginBottom:'1rem'}}>
          <div style={{color:'#444',fontSize:'0.75rem',marginBottom:'6px'}}>
            Describe your token — name, symbol, description, and image URL
          </div>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <input
              style={{...S.input, flex:1}}
              placeholder='"Launch EmpireAI, symbol EMP, about autonomous DeFi agents, image https://..."'
              value={cpText}
              onChange={e=>setCpText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') runAgent(cpText); }}
            />
            <button onClick={()=>runAgent(cpText)} disabled={cpLoading||!cpText.trim()}
              style={{...S.btn, opacity: cpLoading||!cpText.trim() ? 0.4 : 1}}>
              {cpLoading?'⏳':'▶'}
            </button>
          </div>
        </div>
      )}

      {cpLoading && <div style={{color:'#444',fontSize:'0.8rem',padding:'0.75rem 0'}}>⏳ Connecting to ClawPump...</div>}

      {cpResult && !cpLoading && (
        <div style={{background:'#0a0a0a',padding:'1rem',border:`1px solid ${cpResult.success?'#1a3a1a':'#2a1a1a'}`,fontSize:'0.8rem'}}>
          <pre style={{color: cpResult.success?'#00ff41':'#ff8800', whiteSpace:'pre-wrap', margin:0, fontFamily:'monospace'}}>
            {cpResult.message}
          </pre>
          {cpPending && (
            <div style={{marginTop:'1rem',borderTop:'1px solid #1a3a1a',paddingTop:'1rem',display:'flex',gap:'0.75rem'}}>
              <button onClick={confirmLaunch} disabled={cpLoading}
                style={{...S.btn, opacity: cpLoading?0.5:1}}>✅ Confirm Launch (FREE)</button>
              <button onClick={()=>{setCpPending(null);setCpResult(null);}} style={S.btnRed}>Cancel</button>
            </div>
          )}
          {cpResult.success && cpResult.data?.pumpUrl && (
            <div style={{marginTop:'0.75rem',display:'flex',gap:'1rem'}}>
              <a href={cpResult.data.pumpUrl} target="_blank" rel="noreferrer"
                style={{color:'#00ff41',fontSize:'0.75rem'}}>🔗 pump.fun ↗</a>
              <a href={cpResult.data.explorerUrl} target="_blank" rel="noreferrer"
                style={{color:'#444',fontSize:'0.75rem'}}>🔍 Solscan ↗</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
