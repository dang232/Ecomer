ALTER TABLE order_svc.order_summary
    ADD COLUMN IF NOT EXISTS order_number VARCHAR(255);

UPDATE order_svc.order_summary summary
SET order_number = orders.order_number
FROM order_svc.orders orders
WHERE summary.order_id = orders.id::text
  AND summary.order_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_summary_order_number
    ON order_svc.order_summary (order_number);
