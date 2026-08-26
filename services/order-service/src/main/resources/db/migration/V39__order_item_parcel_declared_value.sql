ALTER TABLE order_svc.order_items
    ADD COLUMN IF NOT EXISTS parcel_declared_value_minor BIGINT;
