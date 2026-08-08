CREATE INDEX IF NOT EXISTS idx_orders_admin_cursor_status_created_id
    ON order_svc.order_summary (status, created_at DESC, order_id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_admin_cursor_created_id
    ON order_svc.order_summary (created_at DESC, order_id DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_admin_cursor_status_created_id
    ON order_svc.disputes (status, created_at DESC, dispute_id DESC);

-- Admin search uses case-insensitive prefix semantics so the cursor query stays indexable.
CREATE INDEX IF NOT EXISTS idx_order_summary_admin_order_id_prefix
    ON order_svc.order_summary (lower(order_id));
CREATE INDEX IF NOT EXISTS idx_order_summary_admin_order_number_prefix
    ON order_svc.order_summary (lower(order_number));
CREATE INDEX IF NOT EXISTS idx_order_summary_admin_buyer_id_prefix
    ON order_svc.order_summary (lower(buyer_id));
CREATE INDEX IF NOT EXISTS idx_order_summary_admin_seller_id_prefix
    ON order_svc.order_summary (lower(seller_id));

CREATE INDEX IF NOT EXISTS idx_disputes_admin_dispute_id_prefix
    ON order_svc.disputes (lower(dispute_id::text));
CREATE INDEX IF NOT EXISTS idx_disputes_admin_return_id_prefix
    ON order_svc.disputes (lower(return_id::text));
CREATE INDEX IF NOT EXISTS idx_disputes_admin_buyer_reason_prefix
    ON order_svc.disputes (lower(buyer_reason));
CREATE INDEX IF NOT EXISTS idx_disputes_admin_seller_response_prefix
    ON order_svc.disputes (lower(seller_response));
