-- lib/database/schema.sql

-- Users and wallets
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    total_earned DECIMAL(20, 9) DEFAULT 0,
    nft_count INTEGER DEFAULT 0
);

-- Empire NFTs
CREATE TABLE nfts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    mint_address VARCHAR(44) UNIQUE NOT NULL,
    emotion VARCHAR(20) NOT NULL, -- joy, rage, peace, chaos, etc.
    metadata_uri TEXT,
    staked BOOLEAN DEFAULT FALSE,
    rewards_earned DECIMAL(20, 9) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ralph Agent execution history
CREATE TABLE ralph_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL, -- buy, sell, stake, compound
    token_in VARCHAR(44),
    token_out VARCHAR(44),
    amount_in DECIMAL(20, 9),
    amount_out DECIMAL(20, 9),
    gas_cost DECIMAL(20, 9),
    profit_loss DECIMAL(20, 9),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Ralph strategy performance
CREATE TABLE ralph_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    total_profit DECIMAL(20, 9) DEFAULT 0,
    win_rate DECIMAL(5, 2),
    avg_execution_time INTEGER, -- milliseconds
    last_executed TIMESTAMP,
    belief_score DECIMAL(5, 4) DEFAULT 0.5, -- CAC-I belief weight
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Treasury transactions
CREATE TABLE treasury_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL, -- deposit, withdrawal, fee, reward
    amount DECIMAL(20, 9) NOT NULL,
    token VARCHAR(44) NOT NULL,
    from_address VARCHAR(44),
    to_address VARCHAR(44),
    signature VARCHAR(88) UNIQUE,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Yield positions
CREATE TABLE yield_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(50) NOT NULL, -- marinade, raydium, orca, etc.
    pool_address VARCHAR(44) NOT NULL,
    deposited_amount DECIMAL(20, 9),
    current_value DECIMAL(20, 9),
    rewards_earned DECIMAL(20, 9),
    apy DECIMAL(8, 4),
    entered_at TIMESTAMP DEFAULT NOW(),
    last_compound TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Moralis webhook events
CREATE TABLE moralis_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    chain VARCHAR(20) NOT NULL,
    block_number BIGINT,
    transaction_hash VARCHAR(88),
    data JSONB,
    processed BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_nfts_user ON nfts(user_id);
CREATE INDEX idx_nfts_mint ON nfts(mint_address);
CREATE INDEX idx_ralph_strategy ON ralph_executions(strategy);
CREATE INDEX idx_ralph_executed ON ralph_executions(executed_at DESC);
CREATE INDEX idx_treasury_type ON treasury_transactions(type);
CREATE INDEX idx_yield_active ON yield_positions(active, protocol);
CREATE INDEX idx_moralis_processed ON moralis_events(processed, event_type);

-- Initial strategy seeds
INSERT INTO ralph_strategies (name, enabled, belief_score) VALUES
('yield-harvester', true, 0.8),
('signal-seeker', true, 0.6),
('liquidity-sniffer', false, 0.4), -- start disabled, high risk
('zk-farmer', true, 0.7),
('belief-rewrite', true, 1.0); -- always enabled