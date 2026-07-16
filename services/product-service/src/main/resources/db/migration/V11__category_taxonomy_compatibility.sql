-- Some long-lived development databases consumed version 8 before the
-- category taxonomy migration was introduced. Keep recovery idempotent so
-- those databases converge without changing the meaning of version 8.
CREATE TABLE IF NOT EXISTS product_svc.categories (
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

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON product_svc.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON product_svc.categories (sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_active ON product_svc.categories (active);

INSERT INTO product_svc.categories (id, parent_id, name, label, sort_order, active, created_at, updated_at)
SELECT
    category_id,
    NULL,
    LOWER(REGEXP_REPLACE(category_id, '[^a-zA-Z0-9]+', '_', 'g')),
    category_id,
    ROW_NUMBER() OVER (ORDER BY category_id) * 10,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT category_id
    FROM product_svc.products
    WHERE category_id IS NOT NULL AND category_id <> ''
) distinct_categories
ON CONFLICT (id) DO NOTHING;
