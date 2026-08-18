ALTER TABLE order_svc.order_items
    ADD COLUMN IF NOT EXISTS parcel_weight_grams INTEGER,
    ADD COLUMN IF NOT EXISTS parcel_length_cm INTEGER,
    ADD COLUMN IF NOT EXISTS parcel_width_cm INTEGER,
    ADD COLUMN IF NOT EXISTS parcel_height_cm INTEGER;
