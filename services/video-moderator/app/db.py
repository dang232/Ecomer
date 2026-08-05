"""Synchronous database helper for updating video moderation fields.

Uses psycopg2 directly (no ORM) to avoid pulling in a heavy framework.
The video table is owned by product-service; we update only the two
moderation columns that the moderation worker owns.
"""

import logging

import psycopg2

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_conn():
    return psycopg2.connect(get_settings().database_url)


def update_video_moderation(
    *,
    video_id: str,
    nsfw_score: float,
    verdict: str,
    status: str,
    transcoded_object_key: str,
    poster_object_key: str,
    duration_seconds: int | float,
    published: bool,
    rejection_reason: str | None,
) -> None:
    """Persist the moderation outcome and the media location for a video."""
    sql = """
        UPDATE product_svc.videos
        SET
            nsfw_score         = %(nsfw_score)s,
            moderation_verdict = %(verdict)s,
            status             = %(status)s,
            transcoded_object_key = %(transcoded_object_key)s,
            poster_object_key  = %(poster_object_key)s,
            duration_seconds   = %(duration_seconds)s,
            rejection_reason   = %(rejection_reason)s,
            moderated_at       = NOW()
            , published_at = CASE
                WHEN %(published)s THEN COALESCE(published_at, NOW())
                ELSE NULL
            END
            , updated_at = NOW()
        WHERE video_id = %(video_id)s
    """
    params = {
        "video_id": video_id,
        "nsfw_score": nsfw_score,
        "verdict": verdict,
        "status": status,
        "transcoded_object_key": transcoded_object_key,
        "poster_object_key": poster_object_key,
        "duration_seconds": duration_seconds,
        "published": published,
        "rejection_reason": rejection_reason,
    }
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
            conn.commit()
        logger.info(
            "Updated DB: videoId=%s nsfw_score=%.4f verdict=%s status=%s",
            video_id,
            nsfw_score,
            verdict,
            status,
        )
    except Exception:
        logger.exception("Failed to update DB for videoId=%s", video_id)
        raise
