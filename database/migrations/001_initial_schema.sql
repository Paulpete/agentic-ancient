-- Empire Engine Database Schema
-- Migration 001: Initial tables for profit optimization

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sweeps table: Track all token sweeps from relayers
CREATE TABLE sweeps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_hash VARCHAR(128) NOT NULL UNIQUE,
    chain VARCHAR(20) NOT NULL, -- 'solana' | 'ethereum' | 'skale'
    token_address VARCHAR(64),
    token_symbol VARCHAR(10),
    amount DECIMAL(36, 18) NOT NULL,
    usd_value DECIMAL(20, 8),
    from_address VARCHAR(64) NOT NULL,
    to_address VARCHAR(64) NOT NULL,
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'failed'
    gas_fee DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allocations table: Track profit allocation decisions
CREATE TABLE allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sweep_id UUID REFERENCES sweeps(id),
    allocation_type VARCHAR(20) NOT NULL, -- 'vault' | 'growth' | 'speculative' | 'treasury'
    percentage DECIMAL(5, 2) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    usd_value DECIMAL(20, 8),
    target_strategy VARCHAR(50), -- 'staking' | 'lending' | 'yield_farming' | 'hold'
    executed BOOLEAN DEFAULT FALSE,
    execution_tx_hash VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Staking positions table: Track all staking operations
CREATE TABLE staking_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    allocation_id UUID REFERENCES allocations(id),
    chain VARCHAR(20) NOT NULL,
    protocol VARCHAR(50) NOT NULL, -- 'solana_validator' | 'lido' | 'rocketpool'
    validator_address VARCHAR(64),
    stake_amount DECIMAL(36, 18) NOT NULL,
    rewards_earned DECIMAL(36, 18) DEFAULT 0,
    apy DECIMAL(5, 4), -- Annual percentage yield
    stake_tx_hash VARCHAR(128),
    unstake_tx_hash VARCHAR(128),
    status VARCHAR(20) DEFAULT 'active', -- 'active' | 'unstaking' | 'unstaked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reinvestments table: Track compound reinvestment decisions
CREATE TABLE reinvestments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_position_id UUID REFERENCES staking_positions(id),
    reinvestment_type VARCHAR(30) NOT NULL, -- 'compound_staking' | 'diversify_protocol' | 'new_allocation'
    amount DECIMAL(36, 18) NOT NULL,
    target_protocol VARCHAR(50),
    transaction_hash VARCHAR(128),
    gas_optimized BOOLEAN DEFAULT TRUE,
    profit_generated DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table: Track all system operations for transparency
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30), -- 'sweep' | 'allocation' | 'staking' | 'reinvestment'
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR(64), -- System user or external trigger
    ip_address INET,
    user_agent TEXT,
    mutation_logic_id INTEGER, -- Reference to sacred logic version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sweeps_chain_timestamp ON sweeps(chain, timestamp);
CREATE INDEX idx_sweeps_status ON sweeps(status);
CREATE INDEX idx_sweeps_usd_value ON sweeps(usd_value);
CREATE INDEX idx_allocations_type ON allocations(allocation_type);
CREATE INDEX idx_allocations_executed ON allocations(executed);
CREATE INDEX idx_staking_chain_protocol ON staking_positions(chain, protocol);
CREATE INDEX idx_staking_status ON staking_positions(status);
CREATE INDEX idx_audit_operation_timestamp ON audit_log(operation, created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- Create views for reporting
CREATE VIEW profit_summary AS
SELECT 
    DATE_TRUNC('day', s.timestamp) as date,
    s.chain,
    COUNT(*) as sweep_count,
    SUM(s.usd_value) as total_swept_usd,
    SUM(CASE WHEN a.allocation_type = 'vault' THEN a.usd_value ELSE 0 END) as vault_allocated,
    SUM(CASE WHEN a.allocation_type = 'growth' THEN a.usd_value ELSE 0 END) as growth_allocated,
    SUM(CASE WHEN a.allocation_type = 'speculative' THEN a.usd_value ELSE 0 END) as speculative_allocated,
    SUM(CASE WHEN a.allocation_type = 'treasury' THEN a.usd_value ELSE 0 END) as treasury_allocated
FROM sweeps s
LEFT JOIN allocations a ON s.id = a.sweep_id
WHERE s.status = 'confirmed'
GROUP BY DATE_TRUNC('day', s.timestamp), s.chain
ORDER BY date DESC;

CREATE VIEW staking_performance AS
SELECT 
    sp.chain,
    sp.protocol,
    COUNT(*) as position_count,
    SUM(sp.stake_amount) as total_staked,
    SUM(sp.rewards_earned) as total_rewards,
    AVG(sp.apy) as avg_apy,
    SUM(sp.rewards_earned) / SUM(sp.stake_amount) * 100 as realized_return_pct
FROM staking_positions sp
WHERE sp.status IN ('active', 'unstaked')
GROUP BY sp.chain, sp.protocol
ORDER BY total_rewards DESC;