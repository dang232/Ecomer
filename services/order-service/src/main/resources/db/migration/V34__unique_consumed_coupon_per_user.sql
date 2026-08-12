-- Per-user limits above one are supported by the domain model. The coupon row
-- lock in CouponRedemptionService serializes usage-count checks and inserts;
-- do not add a per-user unique index here because it would reject valid uses
-- when per_user_limit > 1.
CREATE INDEX IF NOT EXISTS idx_coupon_usages_consumed_coupon_user
    ON order_svc.coupon_usages (coupon_id, user_id, status);
