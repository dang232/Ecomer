CREATE INDEX idx_reviews_product_status_created_id
    ON product_svc.reviews (product_id, status, created_at DESC, review_id DESC);
