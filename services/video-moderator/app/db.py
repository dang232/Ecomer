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
) -> None:
    """Update nsfw_score and moderation_verdict for the given video_id."""
    sql = """
        UPDATE product_svc.videos
        SET
            nsfw_score         = %(nsfw_score)s,
            moderation_verdict = %(verdict)s,
            moderated_at       = NOW()
        WHERE video_id = %(video_id)s
    """
    params = {
        "video_id": video_id,
        "nsfw_score": nsfw_score,
        "verdict": verdict,
    }
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
            conn.commit()
        logger.info(
            "Updated DB: videoId=%s nsfw_score=%.4f verdict=%s",
            video_id,
            nsfw_score,
            verdict,
        )
    except Exception:
        logger.exception("Failed to update DB for videoId=%s", video_id)
        raise
