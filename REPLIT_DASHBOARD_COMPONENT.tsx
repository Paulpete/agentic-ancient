import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Strategy {
  name: string;
  action: string;
  confidence: number;
  profitLoss: number;
}

interface CycleData {
  cycle: number;
  timestamp: string;
  strategies: Strategy[];
  totalPL: number;
  timeRemaining: string;
}

interface BotStatus {
  status: 'running' | 'paused' | 'stopped';
  cycleCount: number;
  uptime: string;
  authKey: string;
  totalPL: number;
  winRate: number;
}

const ClawAiBotDashboard: React.FC = () => {
  const [botStatus, setBotStatus] = useState<BotStatus>({
    status: 'running',
    cycleCount: 0,
    uptime: '0h 0m',
    authKey: '9787f1e90b9e2ecd...',
    totalPL: 0,
    winRate: 0,
  });

  const [currentCycle, setCurrentCycle] = useState<CycleData | null>(null);
  const [cycleHistory, setCycleHistory] = useState<CycleData[]>([]);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket('ws://localhost:3000/ws/bot/live');

        wsRef.current.onopen = () => {
          setConnected(true);
          addLog('✅ Connected to ClawAi Bot');
        };

        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleBotUpdate(data);
        };

        wsRef.current.onerror = (error) => {
          addLog('❌ WebSocket error: ' + error);
        };

        wsRef.current.onclose = () => {
          setConnected(false);
          addLog('⚠️ Disconnected from bot. Reconnecting...');
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        addLog('Error connecting to WebSocket: ' + error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLog]);

  const handleBotUpdate = (data: any) => {
    switch (data.type) {
      case 'cycle_complete':
        setCurrentCycle(data.data);
        setCycleHistory((prev) => [...prev, data.data]);
        addLog(`🔄 Cycle #${data.data.cycle} completed | P/L: ${data.data.totalPL:+.4f}`);
        break;

      case 'strategy_executed':
        addLog(
          `⚡ ${data.data.strategy} | Action: ${data.data.action} | Conf: ${data.data.confidence.toFixed(2)} | P/L: ${data.data.profitLoss:+.4f}`
        );
        break;

      case 'status_update':
        setBotStatus(data.data);
        break;
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLiveLog((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const sendCommand = (command: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: 'command', command }));
    }
  };

  const chartData = cycleHistory.map((cycle) => ({
    cycle: cycle.cycle,
    pl: cycle.totalPL,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🤖</div>
          <h1 className="text-4xl font-bold">ClawAi Bot Dashboard</h1>
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
        </div>
        <div className="text-sm text-gray-400">
          Status: <span className="text-green-400 font-bold">🟢 Running</span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-6 border border-purple-500">
          <div className="text-gray-400 text-sm">Status</div>
          <div className="text-2xl font-bold text-green-400 mt-2">🟢 Running</div>
          <div className="text-xs text-gray-500 mt-2">Uptime: {botStatus.uptime}</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-blue-500">
          <div className="text-gray-400 text-sm">Cycles Executed</div>
          <div className="text-2xl font-bold text-blue-400 mt-2">{botStatus.cycleCount}</div>
          <div className="text-xs text-gray-500 mt-2">Current cycle active</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-green-500">
          <div className="text-gray-400 text-sm">Total P/L</div>
          <div className={`text-2xl font-bold mt-2 ${botStatus.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {botStatus.totalPL:+.4f} SOL
          </div>
          <div className="text-xs text-gray-500 mt-2">Win Rate: {botStatus.winRate}%</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-yellow-500">
          <div className="text-gray-400 text-sm">Auth Status</div>
          <div className="text-lg font-mono text-yellow-400 mt-2">{botStatus.authKey}</div>
          <div className="text-xs text-gray-500 mt-2">ClawAi verified</div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-slate-800 rounded-lg p-6 border border-purple-500 mb-8">
        <h2 className="text-xl font-bold mb-4">Control Panel</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => sendCommand('/status')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
          >
            📊 Status
          </button>
          <button
            onClick={() => sendCommand('/strategies')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition"
          >
            📋 Strategies
          </button>
          <button
            onClick={() => sendCommand('/report')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition"
          >
            📈 Report
          </button>
          <button
            onClick={() => sendCommand('/stop')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition"
          >
            ⏹ Stop
          </button>
        </div>
      </div>

      {/* Strategy Table */}
      {currentCycle && (
        <div className="bg-slate-800 rounded-lg p-6 border border-cyan-500 mb-8">
          <h2 className="text-xl font-bold mb-4">Current Cycle #{currentCycle.cycle}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-600">
                <tr>
                  <th className="text-left py-2 px-4">Strategy</th>
                  <th className="text-left py-2 px-4">Action</th>
                  <th className="text-left py-2 px-4">Confidence</th>
                  <th className="text-left py-2 px-4">P/L</th>
                </tr>
              </thead>
              <tbody>
                {currentCycle.strategies.map((strategy, idx) => (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-slate-700 transition">
                    <td className="py-3 px-4 font-semibold">{strategy.name}</td>
                    <td className="py-3 px-4">
                      <span className={strategy.action === 'execute' ? 'text-green-400' : 'text-yellow-400'}>
                        {strategy.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">{strategy.confidence.toFixed(2)}</td>
                    <td className={`py-3 px-4 font-bold ${strategy.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {strategy.profitLoss:+.4f}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-right text-lg font-bold text-green-400">
            Total P/L: {currentCycle.totalPL:+.4f} SOL
          </div>
        </div>
      )}

      {/* P/L Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-green-500 mb-8">
          <h2 className="text-xl font-bold mb-4">Profit/Loss Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="cycle" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #666' }} />
              <Legend />
              <Line type="monotone" dataKey="pl" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Live Log */}
      <div className="bg-slate-800 rounded-lg p-6 border border-orange-500">
        <h2 className="text-xl font-bold mb-4">Live Execution Log</h2>
        <div className="bg-slate-900 rounded p-4 h-64 overflow-y-auto font-mono text-xs">
          {liveLog.map((log, idx) => (
            <div key={idx} className="text-gray-300 py-1">
              {log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};

export default ClawAiBotDashboard;
