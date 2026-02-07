-- Initial database schema for CryptoGene-Omega

CREATE TABLE strategies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    parameters JSONB,
    belief_score DOUBLE PRECISION DEFAULT 0.5,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE executions (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN,
    profit_loss DECIMAL(20, 10),
    result JSONB
);

CREATE TABLE mutations (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    old_parameters JSONB,
    new_parameters JSONB,
    fitness_improvement DOUBLE PRECISION
);
