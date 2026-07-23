CREATE TABLE IF NOT EXISTS product_svc.product_rating_projection_backfill (
    id SMALLINT PRIMARY KEY,
    completed_at TIMESTAMPTZ
);

INSERT INTO product_svc.product_rating_projection_backfill (id, completed_at)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
