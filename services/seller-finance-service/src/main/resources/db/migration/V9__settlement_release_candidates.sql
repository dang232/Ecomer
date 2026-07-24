CREATE TABLE IF NOT EXISTS seller_finance_svc.settlement_release_candidates (
    allocation_id UUID PRIMARY KEY,
    allocation_version INTEGER NOT NULL,
    order_id UUID NOT NULL,
    sub_order_id BIGINT NOT NULL,
    seller_id VARCHAR(255) NOT NULL,
    commission_tier VARCHAR(32) NOT NULL,
    frozen_commission_rate NUMERIC(5, 4) NOT NULL,
    item_gmv_amount NUMERIC(19, 0) NOT NULL,
    seller_funded_discount_amount NUMERIC(19, 0) NOT NULL,
    platform_funded_discount_amount NUMERIC(19, 0) NOT NULL,
    buyer_shipping_charge_amount NUMERIC(19, 0) NOT NULL,
    seller_shipping_payable_amount NUMERIC(19, 0) NOT NULL,
    tax_charged_amount NUMERIC(19, 0) NOT NULL,
    seller_tax_payable_amount NUMERIC(19, 0) NOT NULL,
    commission_base_amount NUMERIC(19, 0) NOT NULL,
    platform_commission_amount NUMERIC(19, 0) NOT NULL,
    seller_payable_amount NUMERIC(19, 0) NOT NULL,
    buyer_paid_amount NUMERIC(19, 0) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    delivered_at TIMESTAMPTZ,
    return_hold BOOLEAN NOT NULL DEFAULT FALSE,
    dispute_hold BOOLEAN NOT NULL DEFAULT FALSE,
    fraud_hold BOOLEAN NOT NULL DEFAULT FALSE,
    chargeback_hold BOOLEAN NOT NULL DEFAULT FALSE,
    release_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    release_operation_id UUID NOT NULL,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_settlement_release_operation UNIQUE (release_operation_id),
    CONSTRAINT chk_settlement_release_status CHECK (release_status IN ('PENDING', 'RELEASED', 'BLOCKED')),
    CONSTRAINT chk_settlement_release_currency CHECK (currency = 'VND')
);

CREATE INDEX IF NOT EXISTS idx_settlement_release_eligible
    ON seller_finance_svc.settlement_release_candidates
        (release_status, delivered_at)
    WHERE release_status = 'PENDING'
      AND return_hold = FALSE
      AND dispute_hold = FALSE
      AND fraud_hold = FALSE
      AND chargeback_hold = FALSE;
