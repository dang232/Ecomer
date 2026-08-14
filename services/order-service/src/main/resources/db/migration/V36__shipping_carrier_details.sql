ALTER TABLE order_svc.orders
    ADD COLUMN IF NOT EXISTS shipping_recipient_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS shipping_recipient_phone VARCHAR(64),
    ADD COLUMN IF NOT EXISTS shipping_ward_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS shipping_district_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS shipping_province_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS shipping_weight_grams INTEGER,
    ADD COLUMN IF NOT EXISTS shipping_length_cm INTEGER,
    ADD COLUMN IF NOT EXISTS shipping_width_cm INTEGER,
    ADD COLUMN IF NOT EXISTS shipping_height_cm INTEGER;
