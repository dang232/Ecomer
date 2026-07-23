CREATE TABLE IF NOT EXISTS order_svc.refund_ledger (
    refund_id VARCHAR(255) PRIMARY KEY,
    order_id UUID NOT NULL,
    return_id UUID,
    seller_id VARCHAR(255),
    amount NUMERIC(19, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    refunded_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_ledger_order_id
    ON order_svc.refund_ledger (order_id);

CREATE INDEX IF NOT EXISTS idx_refund_ledger_refunded_at
    ON order_svc.refund_ledger (refunded_at);
