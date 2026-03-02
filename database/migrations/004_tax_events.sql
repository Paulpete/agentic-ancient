-- Migration 004: Tax Events Table
-- Persists tax events captured from Ralph strategy executions.
-- The in-memory log in lib/tax/engine.ts feeds this table via the /api/tax route.

CREATE TABLE IF NOT EXISTS tax_events (
    id                  VARCHAR(32) PRIMARY KEY,
    timestamp           BIGINT NOT NULL,
    date                DATE NOT NULL,
    event_type          VARCHAR(30) NOT NULL,  -- swap | transfer_out | stake_reward | lp_fee | airdrop | nft_sale
    asset               VARCHAR(20) NOT NULL,
    amount              DECIMAL(36, 18) NOT NULL DEFAULT 0,
    cost_basis_usd      DECIMAL(20, 8) NOT NULL DEFAULT 0,
    proceeds_usd        DECIMAL(20, 8) NOT NULL DEFAULT 0,
    gain_loss_usd       DECIMAL(20, 8) NOT NULL DEFAULT 0,
    holding_days        INTEGER NOT NULL DEFAULT 0,
    tax_category        VARCHAR(30) NOT NULL,  -- short_term_gain | long_term_gain | short_term_loss | long_term_loss | ordinary_income | non_taxable
    signature           VARCHAR(128),
    strategy_source     VARCHAR(30),           -- yield | signal | liquidity | zk | arbitrage | manual
    notes               TEXT,
    wallet_address      VARCHAR(64),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for wallet+year queries (tax report generation)
CREATE INDEX IF NOT EXISTS idx_tax_events_wallet_date
    ON tax_events (wallet_address, date);

-- Index for strategy performance analysis
CREATE INDEX IF NOT EXISTS idx_tax_events_strategy
    ON tax_events (strategy_source, timestamp);

-- Index for category aggregation (Form 8949, Schedule D)
CREATE INDEX IF NOT EXISTS idx_tax_events_category
    ON tax_events (tax_category, date);


-- Tax report cache: stores generated report summaries to avoid re-running
-- the Python engine on every request.
CREATE TABLE IF NOT EXISTS tax_report_cache (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address      VARCHAR(64) NOT NULL,
    tax_year            INTEGER NOT NULL,
    cost_basis_method   VARCHAR(10) NOT NULL,  -- fifo | lifo | hifo
    net_capital_gain    DECIMAL(20, 8),
    short_term_gains    DECIMAL(20, 8),
    long_term_gains     DECIMAL(20, 8),
    total_losses        DECIMAL(20, 8),
    total_income        DECIMAL(20, 8),
    estimated_tax       DECIMAL(20, 8),
    transactions_analyzed INTEGER,
    taxable_events      INTEGER,
    income_events       INTEGER,
    csv_path            TEXT,
    json_path           TEXT,
    generated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (wallet_address, tax_year, cost_basis_method)
);

CREATE INDEX IF NOT EXISTS idx_tax_report_cache_wallet_year
    ON tax_report_cache (wallet_address, tax_year);
