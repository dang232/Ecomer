CREATE TABLE product_svc.product_tags (
    product_id UUID NOT NULL REFERENCES product_svc.products(id) ON DELETE CASCADE,
    canonical_key VARCHAR(64) NOT NULL,
    display_label VARCHAR(64) NOT NULL,
    CONSTRAINT pk_product_tags PRIMARY KEY (product_id, canonical_key)
);

CREATE INDEX idx_product_tags_canonical_key ON product_svc.product_tags (canonical_key);
