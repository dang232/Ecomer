-- V7: Video pipeline tables for product_svc
--
-- Adds product_svc.videos and product_svc.video_status_history to support
-- the tus-based video upload pipeline with FFmpeg transcoding and NudeNet
-- moderation. Status values cover the full state machine including appeal workflow.

CREATE TABLE IF NOT EXISTS product_svc.videos (
    video_id              UUID          PRIMARY KEY,
    owner_type            VARCHAR(32)   NOT NULL,       -- 'PRODUCT' | 'REVIEW'
    owner_id              UUID          NOT NULL,
    uploader_id           VARCHAR(255)  NOT NULL,
    status                VARCHAR(32)   NOT NULL,
    raw_object_key        VARCHAR(1024),
    transcoded_object_key VARCHAR(1024),
    poster_object_key     VARCHAR(1024),
    content_type          VARCHAR(255),
    raw_size_bytes        BIGINT,
    transcoded_size_bytes BIGINT,
    duration_seconds      DECIMAL(7,2),                 -- e.g. 127.45; supports sub-second precision
    width                 INTEGER,
    height                INTEGER,
    sha256_hex            CHAR(64),
    nsfw_score            DECIMAL(4,3),
    moderation_verdict    VARCHAR(32),
    rejection_reason      VARCHAR(500),
    appeal_reason         VARCHAR(1000),                -- uploader-supplied appeal text
    moderated_by          VARCHAR(255),
    moderated_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ   NOT NULL,
    updated_at            TIMESTAMPTZ   NOT NULL,
    published_at          TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ                   -- soft-delete timestamp for DELETED transition
);

-- Composite index for owner lookup (list videos for a product or review)
CREATE INDEX IF NOT EXISTS idx_videos_owner
    ON product_svc.videos (owner_type, owner_id);

-- Partial index for active/actionable statuses (moderation queue, admin UI, reaper)
CREATE INDEX IF NOT EXISTS idx_videos_status
    ON product_svc.videos (status)
    WHERE status IN ('PENDING_REVIEW', 'APPEAL_PENDING', 'UPLOADING', 'TRANSCODING', 'MODERATING');

-- Index for uploader lookup (user's video list)
CREATE INDEX IF NOT EXISTS idx_videos_uploader
    ON product_svc.videos (uploader_id);

-- Partial index for stuck-video reaper (@Scheduled, detects stalled UPLOADING/TRANSCODING/MODERATING)
CREATE INDEX IF NOT EXISTS idx_videos_stuck
    ON product_svc.videos (status, updated_at)
    WHERE status IN ('UPLOADING', 'TRANSCODING', 'MODERATING');

-- Status audit trail; one row per transition
CREATE TABLE IF NOT EXISTS product_svc.video_status_history (
    id          BIGSERIAL    PRIMARY KEY,
    video_id    UUID         NOT NULL
                    REFERENCES product_svc.videos (video_id),
    from_status VARCHAR(32),
    to_status   VARCHAR(32)  NOT NULL,
    actor_id    VARCHAR(255),
    reason      VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
