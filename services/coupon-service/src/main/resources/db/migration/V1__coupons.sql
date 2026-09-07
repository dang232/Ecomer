-- Restores the coupons table archived out of coupon-service when coupon
-- ownership moved to order-service. V2__coupon_usage_tracking references
-- coupon_svc.coupons(id) and Flyway runs before Hibernate ddl-auto, so the
-- table must exist here. Column shape mirrors CouponJpaEntity.
CREATE SCHEMA IF NOT EXISTS coupon_svc;
CREATE TABLE IF NOT EXISTS coupon_svc.coupons (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(255) NOT NULL UNIQUE,
    discount_type VARCHAR(255) NOT NULL,
    discount_value NUMERIC(19, 2) NOT NULL,
    min_order_value NUMERIC(19, 2) NOT NULL,
    max_discount NUMERIC(19, 2),
    max_uses INTEGER NOT NULL,
    current_uses INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL
);
