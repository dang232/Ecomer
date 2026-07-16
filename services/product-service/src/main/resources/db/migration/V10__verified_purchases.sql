CREATE TABLE product_svc.verified_purchases (
    purchase_id UUID PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    buyer_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_verified_purchase_order_buyer_product UNIQUE (order_id, buyer_id, product_id)
);

CREATE INDEX idx_verified_purchases_buyer_product
    ON product_svc.verified_purchases (buyer_id, product_id);

CREATE INDEX idx_verified_purchases_order
    ON product_svc.verified_purchases (order_id);
