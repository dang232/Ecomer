CREATE TABLE IF NOT EXISTS order_svc.dlt_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), topic VARCHAR(255) NOT NULL, partition INTEGER NOT NULL,
    kafka_offset BIGINT NOT NULL, record_key VARCHAR(255), payload TEXT NOT NULL, payload_hash VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL, attempts INTEGER NOT NULL, first_seen TIMESTAMPTZ NOT NULL DEFAULT now(), replayed_at TIMESTAMPTZ,
    replay_claimed_at TIMESTAMPTZ, replay_claimed_until TIMESTAMPTZ,
    CONSTRAINT uq_order_dlt_record UNIQUE (topic, partition, kafka_offset, payload_hash)
);
CREATE INDEX IF NOT EXISTS idx_order_dlt_first_seen ON order_svc.dlt_store (first_seen DESC);
