-- Create category taxonomy table
CREATE TABLE product_svc.categories (
    id VARCHAR(255) PRIMARY KEY,
    parent_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES product_svc.categories (id)
);

-- Create index for efficient tree queries
CREATE INDEX idx_categories_parent_id ON product_svc.categories (parent_id);
CREATE INDEX idx_categories_sort_order ON product_svc.categories (sort_order);
CREATE INDEX idx_categories_active ON product_svc.categories (active);

-- Backfill existing categories as root nodes
-- For each distinct category_id in products, create a root category entry
INSERT INTO product_svc.categories (id, parent_id, name, label, sort_order, active, created_at, updated_at)
SELECT
    DISTINCT category_id,
    NULL,
    -- Convert category_id to a stable name (lowercase, replace spaces/special chars with underscores)
    LOWER(REGEXP_REPLACE(category_id, '[^a-zA-Z0-9]+', '_', 'g')),
    -- Use the category_id as the display label (can be customized later)
    category_id,
    ROW_NUMBER() OVER (ORDER BY category_id) * 10,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM product_svc.products
WHERE category_id IS NOT NULL AND category_id != '';
