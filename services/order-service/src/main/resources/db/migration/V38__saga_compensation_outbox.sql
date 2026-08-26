CREATE TABLE IF NOT EXISTS order_svc.saga_compensation_outbox (
    id BIGSERIAL PRIMARY KEY,
    saga_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    step VARCHAR(64) NOT NULL,
    operation_id VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT saga_compensation_outbox_operation_id_key UNIQUE (operation_id)
);

CREATE INDEX IF NOT EXISTS idx_saga_compensation_outbox_due
    ON order_svc.saga_compensation_outbox (status, next_attempt_at, created_at);

-- Relay claims due rows with FOR UPDATE SKIP LOCKED in its native repository query.
