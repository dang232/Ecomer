CREATE TABLE search_svc.product_read_model_tags (
    product_id VARCHAR(64) NOT NULL REFERENCES search_svc.product_read_models(product_id) ON DELETE CASCADE,
    tag_key VARCHAR(64) NOT NULL,
    CONSTRAINT pk_product_read_model_tags PRIMARY KEY (product_id, tag_key)
);

CREATE INDEX idx_product_read_model_tags_key ON search_svc.product_read_model_tags (tag_key);
