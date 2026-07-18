CREATE TABLE inventory_svc.flash_sale_reservation_outbox (
    reservation_id       UUID PRIMARY KEY,
    idempotency_key_hash TEXT NOT NULL UNIQUE,
    request_hash         TEXT NOT NULL,
    product_id           TEXT NOT NULL,
    buyer_id             TEXT NOT NULL,
    quantity             INTEGER NOT NULL CHECK (quantity > 0),
    state                TEXT NOT NULL CHECK (state IN ('PENDING', 'ACCEPTED', 'REJECTED', 'RELEASED')),
    reserved_at          TIMESTAMPTZ NOT NULL,
    expires_at           TIMESTAMPTZ NOT NULL,
    updated_at           TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_flash_sale_reservation_outbox_state
    ON inventory_svc.flash_sale_reservation_outbox (state, updated_at);
