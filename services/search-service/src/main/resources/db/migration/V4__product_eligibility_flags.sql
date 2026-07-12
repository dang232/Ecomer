-- Add search eligibility boolean fields to product_read_models table
ALTER TABLE search_svc.product_read_models
ADD COLUMN same_day_delivery BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN is_official BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for filtering on eligibility flags
CREATE INDEX idx_product_read_models_same_day_delivery ON search_svc.product_read_models (same_day_delivery);
CREATE INDEX idx_product_read_models_verified ON search_svc.product_read_models (verified);
CREATE INDEX idx_product_read_models_is_official ON search_svc.product_read_models (is_official);
