ALTER TABLE search_svc.product_read_models
    ADD COLUMN IF NOT EXISTS average_rating REAL,
    ADD COLUMN IF NOT EXISTS review_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_product_read_models_average_rating
    ON search_svc.product_read_models (average_rating);
