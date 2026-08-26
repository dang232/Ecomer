CREATE INDEX IF NOT EXISTS idx_reviews_admin_pending_created_id
    ON product_svc.reviews (status, created_at DESC, review_id DESC)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_videos_admin_queue_created_id
    ON product_svc.videos (status, created_at ASC, video_id ASC)
    WHERE status IN ('PENDING_REVIEW', 'APPEAL_PENDING');
