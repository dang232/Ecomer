ALTER TABLE product_svc.product_variants
    ADD COLUMN weight_grams INTEGER,
    ADD COLUMN length_mm INTEGER,
    ADD COLUMN width_mm INTEGER,
    ADD COLUMN height_mm INTEGER,
    ADD COLUMN declared_value_minor BIGINT;

UPDATE product_svc.product_variants
SET weight_grams = CASE
        WHEN parcel_weight_grams IS NOT NULL
            AND parcel_length_cm IS NOT NULL
            AND parcel_width_cm IS NOT NULL
            AND parcel_height_cm IS NOT NULL
            THEN parcel_weight_grams
        ELSE 1000
    END,
    length_mm = CASE
        WHEN parcel_weight_grams IS NOT NULL
            AND parcel_length_cm IS NOT NULL
            AND parcel_width_cm IS NOT NULL
            AND parcel_height_cm IS NOT NULL
            THEN parcel_length_cm * 10
        ELSE 300
    END,
    width_mm = CASE
        WHEN parcel_weight_grams IS NOT NULL
            AND parcel_length_cm IS NOT NULL
            AND parcel_width_cm IS NOT NULL
            AND parcel_height_cm IS NOT NULL
            THEN parcel_width_cm * 10
        ELSE 200
    END,
    height_mm = CASE
        WHEN parcel_weight_grams IS NOT NULL
            AND parcel_length_cm IS NOT NULL
            AND parcel_width_cm IS NOT NULL
            AND parcel_height_cm IS NOT NULL
            THEN parcel_height_cm * 10
        ELSE 100
    END,
    declared_value_minor = ROUND(price_amount)::BIGINT;

ALTER TABLE product_svc.product_variants
    ALTER COLUMN weight_grams SET NOT NULL,
    ALTER COLUMN length_mm SET NOT NULL,
    ALTER COLUMN width_mm SET NOT NULL,
    ALTER COLUMN height_mm SET NOT NULL,
    ALTER COLUMN declared_value_minor SET NOT NULL;

ALTER TABLE product_svc.product_variants
    ADD CONSTRAINT product_variants_weight_grams_check CHECK (weight_grams > 0),
    ADD CONSTRAINT product_variants_length_mm_check CHECK (length_mm BETWEEN 1 AND 2000),
    ADD CONSTRAINT product_variants_width_mm_check CHECK (width_mm BETWEEN 1 AND 2000),
    ADD CONSTRAINT product_variants_height_mm_check CHECK (height_mm BETWEEN 1 AND 2000),
    ADD CONSTRAINT product_variants_declared_value_minor_check
        CHECK (declared_value_minor BETWEEN 0 AND 999999999);

ALTER TABLE product_svc.product_variants
    DROP COLUMN parcel_weight_grams,
    DROP COLUMN parcel_length_cm,
    DROP COLUMN parcel_width_cm,
    DROP COLUMN parcel_height_cm;
