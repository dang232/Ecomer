CREATE TABLE IF NOT EXISTS shipping_svc.cod_collection_evidence (
    evidence_id UUID NOT NULL PRIMARY KEY,
    shipment_id UUID NOT NULL,
    collection_id UUID,
    carrier_event_id VARCHAR(255),
    order_id VARCHAR(255) NOT NULL,
    carrier VARCHAR(32) NOT NULL,
    tracking_code VARCHAR(255) NOT NULL,
    expected_cod_amount NUMERIC(19, 2),
    collected_cod_amount NUMERIC(19, 2),
    currency VARCHAR(3) NOT NULL,
    provider_timestamp TIMESTAMPTZ,
    evidence_status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cod_evidence_carrier_tracking UNIQUE (carrier, tracking_code),
    CONSTRAINT uq_cod_evidence_carrier_event UNIQUE (carrier, carrier_event_id)
);

CREATE INDEX IF NOT EXISTS idx_cod_collection_evidence_order_id
    ON shipping_svc.cod_collection_evidence (order_id);

CREATE INDEX IF NOT EXISTS idx_cod_collection_evidence_status
    ON shipping_svc.cod_collection_evidence (evidence_status);
