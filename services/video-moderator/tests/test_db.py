"""Focused persistence tests for moderation outcomes."""

from unittest.mock import MagicMock, patch

import pytest

from app.db import update_video_moderation


@pytest.mark.parametrize(
    ("verdict", "status", "published", "rejection_reason"),
    [
        ("AUTO_APPROVED", "PUBLISHED", True, None),
        ("PENDING_REVIEW", "PENDING_REVIEW", False, None),
        ("AUTO_REJECTED", "REJECTED", False, "NSFW score exceeded AUTO_REJECTED threshold"),
    ],
)
def test_update_video_moderation_persists_complete_outcome(
    verdict,
    status,
    published,
    rejection_reason,
):
    connection = MagicMock()
    connection.__enter__.return_value = connection
    cursor = connection.cursor.return_value.__enter__.return_value

    with patch("app.db._get_conn", return_value=connection):
        update_video_moderation(
            video_id="00000000-0000-0000-0000-000000000123",
            nsfw_score=0.42,
            verdict=verdict,
            status=status,
            transcoded_object_key="vnshop-videos-staging/products/product-123/videos/video-123_720p.mp4",
            poster_object_key="vnshop-videos-staging/products/product-123/videos/video-123_poster.jpg",
            duration_seconds=42,
            published=published,
            rejection_reason=rejection_reason,
        )

    sql, params = cursor.execute.call_args.args
    assert "status" in sql
    assert "transcoded_object_key" in sql
    assert "poster_object_key" in sql
    assert "duration_seconds" in sql
    assert "published_at" in sql
    assert params == {
        "video_id": "00000000-0000-0000-0000-000000000123",
        "nsfw_score": 0.42,
        "verdict": verdict,
        "status": status,
        "transcoded_object_key": "vnshop-videos-staging/products/product-123/videos/video-123_720p.mp4",
        "poster_object_key": "vnshop-videos-staging/products/product-123/videos/video-123_poster.jpg",
        "duration_seconds": 42,
        "published": published,
        "rejection_reason": rejection_reason,
    }
    connection.commit.assert_called_once()
