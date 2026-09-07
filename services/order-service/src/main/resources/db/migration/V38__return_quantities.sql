ALTER TABLE order_svc.returns
    ADD COLUMN IF NOT EXISTS returned_quantity INTEGER;
