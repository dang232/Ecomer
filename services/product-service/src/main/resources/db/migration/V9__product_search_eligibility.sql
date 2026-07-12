-- Add search eligibility boolean fields to products table
ALTER TABLE product_svc.products
ADD COLUMN same_day_delivery BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN is_official BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for filtering on eligibility flags
CREATE INDEX idx_products_same_day_delivery ON product_svc.products (same_day_delivery);
CREATE INDEX idx_products_verified ON product_svc.products (verified);
CREATE INDEX idx_products_is_official ON product_svc.products (is_official);
