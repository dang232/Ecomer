CREATE TABLE IF NOT EXISTS shipping_svc.shipping_labels (
    label_id UUID NOT NULL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    carrier VARCHAR(32) NOT NULL,
    tracking_code VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shipping_label_carrier_tracking UNIQUE (carrier, tracking_code)
);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_status
    ON shipping_svc.shipping_labels (order_id, status);
