CREATE TABLE IF NOT EXISTS seller_finance_svc.chargeback_hold_allocations (
    hold_id UUID PRIMARY KEY,
    seller_id VARCHAR(255) NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    source_bucket VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_chargeback_hold_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_chargeback_hold_source_bucket CHECK (source_bucket IN ('SETTLEMENT_PENDING', 'AVAILABLE', 'RESERVE')),
    CONSTRAINT ck_chargeback_hold_status CHECK (status IN ('HELD', 'RELEASED', 'FINALIZED'))
);

CREATE INDEX IF NOT EXISTS idx_chargeback_hold_seller_status
    ON seller_finance_svc.chargeback_hold_allocations (seller_id, status);
