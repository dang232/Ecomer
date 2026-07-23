-- A sub-order can have at most one refund workflow. The application checks
-- first for a friendly error, while this index closes the concurrent-request
-- race and makes admin refund retries safe at the database boundary.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM order_svc.returns
        GROUP BY sub_order_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'duplicate return rows exist for at least one sub-order; resolve before V29';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_returns_sub_order_id
    ON order_svc.returns (sub_order_id);
