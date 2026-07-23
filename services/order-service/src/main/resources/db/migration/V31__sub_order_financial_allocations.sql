CREATE TABLE order_svc.sub_order_financial_allocations (
    allocation_id UUID PRIMARY KEY,
    allocation_version INTEGER NOT NULL,
    order_id UUID NOT NULL,
    sub_order_id BIGINT NOT NULL,
    seller_id VARCHAR(255) NOT NULL,
    commission_tier VARCHAR(20) NOT NULL,
    frozen_commission_rate DECIMAL(5, 4) NOT NULL,
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
    source VARCHAR(20) NOT NULL,
    allocated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sub_order_financial_allocations_version UNIQUE (sub_order_id, allocation_version),
    CONSTRAINT chk_sub_order_financial_allocations_source CHECK (source IN ('NATIVE_V1', 'LEGACY_BACKFILL'))
);

CREATE INDEX idx_sub_order_financial_allocations_order_id
    ON order_svc.sub_order_financial_allocations (order_id);
