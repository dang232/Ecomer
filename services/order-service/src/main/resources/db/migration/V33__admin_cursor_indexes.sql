CREATE INDEX IF NOT EXISTS idx_orders_admin_cursor_status_created_id
    ON order_svc.order_summary (status, created_at DESC, order_id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_admin_cursor_created_id
    ON order_svc.order_summary (created_at DESC, order_id DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_admin_cursor_status_created_id
    ON order_svc.disputes (status, created_at DESC, dispute_id DESC);
