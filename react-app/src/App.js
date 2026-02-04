import React from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import Sweeps from './components/Sweeps';
import Allocations from './components/Allocations';
import Staking from './components/Staking';

function App() {
  return (
    <div className="App">
      <Dashboard />
      <div className="main-content">
        <Sweeps />
        <Allocations />
        <Staking />
      </div>
    </div>
  );
}

export default App;
