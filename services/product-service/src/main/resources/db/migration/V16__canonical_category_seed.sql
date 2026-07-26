-- Keep the API taxonomy aligned with the storefront's stable category IDs.
-- The upsert is safe for databases where some categories were created by an
-- earlier product backfill or by a demo seed run.
INSERT INTO product_svc.categories (id, parent_id, name, label, sort_order, active, created_at, updated_at)
VALUES
    ('electronics', NULL, 'electronics', 'Electronics', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('fashion', NULL, 'fashion', 'Fashion', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('home', NULL, 'home', 'Home & Living', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('software', NULL, 'software', 'Software & Digital', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('beauty', NULL, 'beauty', 'Beauty', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sports', NULL, 'sports', 'Sports', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('books', NULL, 'books', 'Books', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('automotive', NULL, 'automotive', 'Automotive', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('digital', NULL, 'digital', 'Digital Goods', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('food', NULL, 'food', 'Food & Beverages', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    active = EXCLUDED.active,
    updated_at = CURRENT_TIMESTAMP;
