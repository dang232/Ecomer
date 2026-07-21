CREATE TABLE IF NOT EXISTS shipping_svc.carrier_webhook_outbox (
    id              UUID         NOT NULL PRIMARY KEY,
    carrier         VARCHAR(32)  NOT NULL,
    event_id        VARCHAR(255) NOT NULL,
    order_id        VARCHAR(255) NOT NULL,
    tracking_code   VARCHAR(255) NOT NULL,
    status          VARCHAR(64)  NOT NULL,
    status_text     TEXT         NOT NULL DEFAULT '',
    event_timestamp VARCHAR(128),
    payload         TEXT         NOT NULL,
    state           VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    attempts        INT          NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    claimed_at      TIMESTAMPTZ,
    last_error      VARCHAR(1000),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ,
    CONSTRAINT uq_carrier_webhook_outbox_event UNIQUE (carrier, event_id)
);

CREATE INDEX IF NOT EXISTS idx_carrier_webhook_outbox_pending
    ON shipping_svc.carrier_webhook_outbox (state, next_retry_at, created_at)
    WHERE state = 'PENDING';
