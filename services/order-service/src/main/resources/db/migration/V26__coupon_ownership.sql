ALTER TABLE order_svc.coupons
    ADD COLUMN IF NOT EXISTS legacy_id BIGINT,
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coupons_legacy_id
    ON order_svc.coupons (legacy_id)
    WHERE legacy_id IS NOT NULL;

ALTER TABLE order_svc.coupon_usages
    ADD COLUMN IF NOT EXISTS status VARCHAR(16),
    ADD COLUMN IF NOT EXISTS released_at TIMESTAMP WITH TIME ZONE;

UPDATE order_svc.coupon_usages
SET status = CASE WHEN active THEN 'CONSUMED' ELSE 'RELEASED' END
WHERE status IS NULL;

ALTER TABLE order_svc.coupon_usages
    ALTER COLUMN status SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_usages_order_id
    ON order_svc.coupon_usages (order_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user_status
    ON order_svc.coupon_usages (coupon_id, user_id, status);

DO $migration$
BEGIN
    IF to_regclass('coupon_svc.coupons') IS NOT NULL THEN
        EXECUTE $sql$
            INSERT INTO order_svc.coupons (
                id, legacy_id, code, type, value, max_discount_amount,
                min_order_value_amount, total_usage_limit, total_used,
                per_user_limit, valid_from, valid_until, active,
                coupon_created_at, created_at, updated_at, version
            )
            SELECT
                md5('vnshop-coupon:' || source.id::text)::uuid,
                source.id,
                upper(regexp_replace(source.code, '\s+', '', 'g')),
                source.discount_type,
                round(source.discount_value),
                CASE WHEN source.max_discount IS NULL THEN NULL ELSE round(source.max_discount) END,
                round(source.min_order_value),
                source.max_uses,
                source.current_uses,
                1,
                source.valid_from AT TIME ZONE 'UTC',
                source.valid_until AT TIME ZONE 'UTC',
                source.active,
                source.valid_from AT TIME ZONE 'UTC',
                now(),
                now(),
                0
            FROM coupon_svc.coupons source
            ON CONFLICT (code) DO NOTHING
        $sql$;
    END IF;

    IF to_regclass('coupon_svc.coupon_usages') IS NOT NULL THEN
        EXECUTE $sql$
            INSERT INTO order_svc.coupon_usages (
                id, coupon_id, user_id, order_id, active, status,
                created_at, updated_at
            )
            SELECT
                md5('vnshop-coupon-usage:' || usage.id::text)::uuid,
                md5('vnshop-coupon:' || usage.coupon_id::text)::uuid,
                usage.user_id,
                md5('vnshop-coupon-usage-order:' || usage.id::text)::uuid,
                true,
                'CONSUMED',
                usage.used_at,
                usage.used_at
            FROM coupon_svc.coupon_usages usage
            JOIN order_svc.coupons coupon
              ON coupon.id = md5('vnshop-coupon:' || usage.coupon_id::text)::uuid
            ON CONFLICT (order_id) DO NOTHING
        $sql$;
    END IF;
END
$migration$;
