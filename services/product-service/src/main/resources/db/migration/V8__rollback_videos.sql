-- V8: Rollback for V7 (video pipeline tables)
--
-- Drops product_svc.video_status_history and product_svc.videos.
-- Only execute after incident command confirms no deployed code still
-- reads or writes these tables.

DROP TABLE IF EXISTS product_svc.video_status_history;
DROP TABLE IF EXISTS product_svc.videos;
