-- Migration 002: Mutation and Sacred Logic tracking

-- Sacred logic versions table: Track mutation engine iterations
CREATE TABLE sacred_logic_versions (
    id SERIAL PRIMARY KEY,
    version_hash VARCHAR(64) NOT NULL UNIQUE,
    mutation_type VARCHAR(30) NOT NULL, -- 'profit_optimization' | 'risk_adjustment' | 'strategy_enhancement'
    logic_code TEXT NOT NULL, -- The actual sacred logic
    performance_score DECIMAL(5, 4), -- 0.0000 to 1.0000
    deployment_chains TEXT[], -- Array of chains where deployed
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Chain deployments table: Track contract deployments across chains
CREATE TABLE chain_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacred_logic_id INTEGER REFERENCES sacred_logic_versions(id),
    chain VARCHAR(20) NOT NULL,
    contract_address VARCHAR(64) NOT NULL,
    deployment_tx_hash VARCHAR(128),
    deployment_cost DECIMAL(20, 8),
    gas_used BIGINT,
    deployer_address VARCHAR(64),
    status VARCHAR(20) DEFAULT 'deploying', -- 'deploying' | 'active' | 'failed' | 'deprecated'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Cross-chain sync table: Track Wormhole/ChainsAtlas synchronization
CREATE TABLE cross_chain_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_chain VARCHAR(20) NOT NULL,
    target_chain VARCHAR(20) NOT NULL,
    message_type VARCHAR(30) NOT NULL, -- 'profit_claim' | 'strategy_update' | 'nft_fusion'
    source_tx_hash VARCHAR(128) NOT NULL,
    target_tx_hash VARCHAR(128),
    wormhole_sequence BIGINT,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'relayed' | 'completed' | 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- NFT traits and fusion table: Track sacred multiplier applications
CREATE TABLE nft_fusions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_nft_address VARCHAR(64) NOT NULL,
    base_nft_id VARCHAR(32) NOT NULL,
    fusion_nft_address VARCHAR(64),
    fusion_nft_id VARCHAR(32),
    chain VARCHAR(20) NOT NULL,
    sacred_multiplier DECIMAL(8, 6) DEFAULT 1.000000, -- Sacred enhancement factor
    trait_hash VARCHAR(64), -- Hash of combined traits
    fusion_tx_hash VARCHAR(128),
    profit_boost_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    boosted_at TIMESTAMP WITH TIME ZONE
);

-- Treasury claims table: Track auto-claim operations
CREATE TABLE treasury_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain VARCHAR(20) NOT NULL,
    contract_address VARCHAR(64) NOT NULL,
    claim_type VARCHAR(30) NOT NULL, -- 'staking_rewards' | 'trading_profits' | 'nft_royalties'
    amount DECIMAL(36, 18) NOT NULL,
    token_address VARCHAR(64),
    token_symbol VARCHAR(10),
    treasury_address VARCHAR(64) NOT NULL,
    claim_tx_hash VARCHAR(128),
    gas_cost DECIMAL(20, 8),
    net_profit DECIMAL(36, 18), -- Amount minus gas costs
    auto_claimed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mutation logs table: Track all sacred logic generation events
CREATE TABLE mutation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacred_logic_id INTEGER REFERENCES sacred_logic_versions(id),
    trigger_event VARCHAR(50) NOT NULL, -- 'scheduled' | 'profit_threshold' | 'market_change'
    input_parameters JSONB,
    output_logic TEXT,
    performance_prediction DECIMAL(5, 4),
    github_commit_hash VARCHAR(40), -- When pushed to GitHub
    deployment_status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'deployed' | 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for mutation tracking
CREATE INDEX idx_sacred_logic_active ON sacred_logic_versions(is_active, generated_at);
CREATE INDEX idx_chain_deployments_status ON chain_deployments(status, chain);
CREATE INDEX idx_cross_chain_sync_status ON cross_chain_sync(status, created_at);
CREATE INDEX idx_nft_fusions_chain ON nft_fusions(chain, profit_boost_applied);
CREATE INDEX idx_treasury_claims_chain_type ON treasury_claims(chain, claim_type);
CREATE INDEX idx_mutation_logs_trigger ON mutation_logs(trigger_event, created_at);

-- Create views for mutation monitoring
CREATE VIEW active_deployments AS
SELECT 
    slv.id as logic_id,
    slv.version_hash,
    slv.mutation_type,
    slv.performance_score,
    cd.chain,
    cd.contract_address,
    cd.status as deployment_status,
    cd.created_at as deployed_at
FROM sacred_logic_versions slv
JOIN chain_deployments cd ON slv.id = cd.sacred_logic_id
WHERE slv.is_active = TRUE 
  AND cd.status = 'active'
ORDER BY slv.generated_at DESC;

CREATE VIEW cross_chain_summary AS
SELECT 
    source_chain,
    target_chain,
    message_type,
    COUNT(*) as total_messages,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_completion_time_seconds
FROM cross_chain_sync
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source_chain, target_chain, message_type
ORDER BY total_messages DESC;