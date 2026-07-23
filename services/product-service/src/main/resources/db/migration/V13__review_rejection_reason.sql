ALTER TABLE product_svc.reviews
    ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(1000);
