ALTER TABLE product_svc.product_variants
    ADD COLUMN parcel_weight_grams INTEGER,
    ADD COLUMN parcel_length_cm INTEGER,
    ADD COLUMN parcel_width_cm INTEGER,
    ADD COLUMN parcel_height_cm INTEGER;
