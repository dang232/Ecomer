-- Repair the buyer order read model. Earlier projection events stored payment
-- states in the status column and omitted item counts.
UPDATE order_svc.order_summary summary
SET status = CASE
        WHEN EXISTS (
            SELECT 1 FROM order_svc.sub_orders sub
            WHERE sub.order_id = orders.id
              AND sub.fulfillment_status = 'PENDING_ACCEPTANCE'
        ) THEN 'PENDING'
        WHEN EXISTS (
            SELECT 1 FROM order_svc.sub_orders sub
            WHERE sub.order_id = orders.id
              AND sub.fulfillment_status IN ('ACCEPTED', 'PACKED')
        ) THEN 'CONFIRMED'
        WHEN EXISTS (
            SELECT 1 FROM order_svc.sub_orders sub
            WHERE sub.order_id = orders.id
              AND sub.fulfillment_status = 'SHIPPED'
        ) THEN 'SHIPPED'
        WHEN EXISTS (
            SELECT 1 FROM order_svc.sub_orders sub
            WHERE sub.order_id = orders.id
              AND sub.fulfillment_status = 'DELIVERED'
        ) THEN 'DELIVERED'
        WHEN EXISTS (
            SELECT 1 FROM order_svc.sub_orders sub
            WHERE sub.order_id = orders.id
        ) THEN 'CANCELLED'
        ELSE 'PENDING'
    END,
    seller_id = COALESCE((
        SELECT sub.seller_id
        FROM order_svc.sub_orders sub
        WHERE sub.order_id = orders.id
        ORDER BY sub.id
        LIMIT 1
    ), summary.seller_id),
    total_amount = orders.final_amount,
    item_count = COALESCE((
        SELECT SUM(item.quantity)::int
        FROM order_svc.sub_orders sub
        JOIN order_svc.order_items item ON item.sub_order_id = sub.id
        WHERE sub.order_id = orders.id
    ), 0),
    updated_at = NOW()
FROM order_svc.orders orders
WHERE summary.order_id = orders.id::text;
