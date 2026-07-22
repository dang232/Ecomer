CREATE TABLE IF NOT EXISTS search_svc.product_projection_repairs (
    event_id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_projection_repairs_created_at
    ON search_svc.product_projection_repairs (created_at);
