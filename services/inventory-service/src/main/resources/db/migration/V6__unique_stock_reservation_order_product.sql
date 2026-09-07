DELETE FROM inventory_svc.stock_reservations duplicate
USING (
    SELECT reservation_id,
           ROW_NUMBER() OVER (PARTITION BY order_id, product_id ORDER BY created_at, reservation_id) AS duplicate_number
    FROM inventory_svc.stock_reservations
) ranked
WHERE duplicate.reservation_id = ranked.reservation_id
  AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_reservations_order_product
    ON inventory_svc.stock_reservations (order_id, product_id);
