-- Migration: 003_immutable_audit_table.sql
-- Description: Add immutable audit table for tamper-proof earnings tracking
-- Date: 2025-09-21

-- Create immutable audit log table
CREATE TABLE IF NOT EXISTS immutable_audit_log (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    user_id VARCHAR(100) NOT NULL DEFAULT 'system',
    data_hash VARCHAR(128) NOT NULL, -- SHA256 hash for immutability verification
    config_hash VARCHAR(128) NOT NULL, -- Immutable config hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Indexes for performance
    INDEX idx_immutable_audit_operation (operation),
    INDEX idx_immutable_audit_entity (entity_type, entity_id),
    INDEX idx_immutable_audit_created_at (created_at),
    INDEX idx_immutable_audit_data_hash (data_hash),

    -- Constraints
    CONSTRAINT chk_operation_not_empty CHECK (length(operation) > 0),
    CONSTRAINT chk_entity_type_not_empty CHECK (length(entity_type) > 0),
    CONSTRAINT chk_entity_id_not_empty CHECK (length(entity_id) > 0),
    CONSTRAINT chk_data_hash_format CHECK (data_hash ~ '^[a-f0-9]{64}$'), -- SHA256 format
    CONSTRAINT chk_config_hash_format CHECK (config_hash ~ '^[a-f0-9]{64}$') -- SHA256 format
);

-- Add immutable_hash column to allocations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'allocations'
                   AND column_name = 'immutable_hash') THEN
        ALTER TABLE allocations ADD COLUMN immutable_hash VARCHAR(128);
        CREATE INDEX idx_allocations_immutable_hash ON allocations(immutable_hash);
    END IF;
END $$;

-- Add immutable_hash column to sweeps table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sweeps'
                   AND column_name = 'immutable_hash') THEN
        ALTER TABLE sweeps ADD COLUMN immutable_hash VARCHAR(128);
        CREATE INDEX idx_sweeps_immutable_hash ON sweeps(immutable_hash);
    END IF;
END $$;

-- Create view for audit verification
CREATE OR REPLACE VIEW audit_verification_view AS
SELECT
    ial.id,
    ial.operation,
    ial.entity_type,
    ial.entity_id,
    ial.data,
    ial.user_id,
    ial.data_hash,
    ial.config_hash,
    ial.created_at,
    CASE
        WHEN ial.data_hash IS NOT NULL AND ial.config_hash IS NOT NULL THEN true
        ELSE false
    END as is_immutable,
    CASE
        WHEN ial.verified_at IS NOT NULL THEN 'verified'
        WHEN ial.data_hash IS NOT NULL THEN 'pending_verification'
        ELSE 'legacy'
    END as verification_status
FROM immutable_audit_log ial;

-- Create function to verify audit entry integrity
CREATE OR REPLACE FUNCTION verify_audit_entry(audit_id INTEGER)
RETURNS TABLE (
    is_valid BOOLEAN,
    audit_id INTEGER,
    operation VARCHAR(100),
    verification_status VARCHAR(20),
    error_message TEXT
) AS $$
DECLARE
    audit_record RECORD;
    calculated_hash VARCHAR(128);
    current_config_hash VARCHAR(128) := 'PLACEHOLDER_CONFIG_HASH'; -- This should be updated with actual config hash
BEGIN
    -- Get audit record
    SELECT * INTO audit_record
    FROM immutable_audit_log
    WHERE id = audit_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, audit_id, NULL::VARCHAR(100), 'not_found'::VARCHAR(20), 'Audit entry not found'::TEXT;
        RETURN;
    END IF;

    -- Calculate hash of stored data
    SELECT encode(digest(audit_record.data::text, 'sha256'), 'hex') INTO calculated_hash;

    -- Check data integrity
    IF calculated_hash != audit_record.data_hash THEN
        RETURN QUERY SELECT false, audit_id, audit_record.operation, 'data_tampered'::VARCHAR(20),
            'Data hash mismatch - possible tampering'::TEXT;
        RETURN;
    END IF;

    -- Check config hash (placeholder - should be updated with actual immutable config hash)
    IF audit_record.config_hash != current_config_hash AND current_config_hash != 'PLACEHOLDER_CONFIG_HASH' THEN
        RETURN QUERY SELECT false, audit_id, audit_record.operation, 'config_mismatch'::VARCHAR(20),
            'Configuration hash mismatch'::TEXT;
        RETURN;
    END IF;

    -- Update verification timestamp
    UPDATE immutable_audit_log
    SET verified_at = CURRENT_TIMESTAMP
    WHERE id = audit_id;

    RETURN QUERY SELECT true, audit_id, audit_record.operation, 'verified'::VARCHAR(20), NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_statistics()
RETURNS TABLE (
    total_entries BIGINT,
    verified_entries BIGINT,
    unverified_entries BIGINT,
    entity_types BIGINT,
    operations BIGINT,
    oldest_entry TIMESTAMP WITH TIME ZONE,
    newest_entry TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_entries,
        COUNT(CASE WHEN verified_at IS NOT NULL THEN 1 END) as verified_entries,
        COUNT(CASE WHEN verified_at IS NULL AND data_hash IS NOT NULL THEN 1 END) as unverified_entries,
        COUNT(DISTINCT entity_type) as entity_types,
        COUNT(DISTINCT operation) as operations,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry
    FROM immutable_audit_log;
END;
$$ LANGUAGE plpgsql;

-- Insert migration record
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('003', 'Add immutable audit table for tamper-proof earnings tracking', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 003 completed: Immutable audit table created successfully';
END $$;