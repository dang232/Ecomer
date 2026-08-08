-- flyway:executeInTransaction=false
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_admin_cursor_created_id
    ON seller_finance_svc.payouts (created_at DESC, payout_id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_admin_cursor_status_created_id
    ON seller_finance_svc.payouts (status, created_at DESC, payout_id DESC);
