"""Unit tests for ModerationConsumer — threshold classification and workflow routing."""

import json
from unittest.mock import MagicMock, patch, call

import pytest

from app.config import Settings
from app.consumer import ModerationConsumer, _VERDICT_AUTO_APPROVED, _VERDICT_PENDING_REVIEW, _VERDICT_AUTO_REJECTED


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def settings():
    return Settings(
        kafka_bootstrap_servers="kafka:9092",
        kafka_security_protocol="PLAINTEXT",
        nsfw_threshold_auto_approve=0.3,
        nsfw_threshold_auto_reject=0.7,
        tmp_dir="/tmp/test-moderator",
        retry_delays=[0, 0, 0],  # instant retries in tests
    )


@pytest.fixture
def consumer(settings):
    with patch("app.consumer.ModerationProducer"), \
         patch("app.consumer.StorageClient"), \
         patch("app.consumer.Moderator"):
        c = ModerationConsumer(settings)
    return c


# ---------------------------------------------------------------------------
# _classify tests
# ---------------------------------------------------------------------------

class TestClassify:
    def test_below_approve_threshold(self, consumer):
        assert consumer._classify(0.0) == _VERDICT_AUTO_APPROVED
        assert consumer._classify(0.29) == _VERDICT_AUTO_APPROVED

    def test_at_approve_threshold_is_pending(self, consumer):
        assert consumer._classify(0.3) == _VERDICT_PENDING_REVIEW

    def test_between_thresholds(self, consumer):
        assert consumer._classify(0.5) == _VERDICT_PENDING_REVIEW
        assert consumer._classify(0.7) == _VERDICT_PENDING_REVIEW

    def test_above_reject_threshold(self, consumer):
        assert consumer._classify(0.71) == _VERDICT_AUTO_REJECTED
        assert consumer._classify(1.0) == _VERDICT_AUTO_REJECTED


# ---------------------------------------------------------------------------
# _process_message routing tests
# ---------------------------------------------------------------------------

class TestProcessMessage:
    def _make_payload(self, video_id="vid-123", object_key="videos/vid-123.mp4"):
        return {"videoId": video_id, "objectKey": object_key}

    def test_auto_approved_promotes_to_public_and_emits_event(self, consumer):
        payload = self._make_payload()
        consumer._moderator.analyze_video.return_value = 0.1
        consumer._storage.download = MagicMock()
        consumer._storage.promote_to_public = MagicMock()

        with patch("app.consumer.update_video_moderation"), \
             patch("os.path.exists", return_value=False):
            consumer._process_message(payload)

        consumer._storage.promote_to_public.assert_called_once_with("videos/vid-123.mp4")
        consumer._producer.send_moderation_completed.assert_called_once()
        call_kwargs = consumer._producer.send_moderation_completed.call_args.kwargs
        assert call_kwargs["verdict"] == _VERDICT_AUTO_APPROVED
        assert call_kwargs["nsfw_score"] == pytest.approx(0.1)

    def test_pending_review_stays_in_staging_emits_pending_event(self, consumer):
        payload = self._make_payload()
        consumer._moderator.analyze_video.return_value = 0.5
        consumer._storage.download = MagicMock()

        with patch("app.consumer.update_video_moderation"), \
             patch("os.path.exists", return_value=False):
            consumer._process_message(payload)

        consumer._storage.promote_to_public.assert_not_called()
        consumer._producer.send_pending_review.assert_called_once()
        call_kwargs = consumer._producer.send_pending_review.call_args.kwargs
        assert call_kwargs["nsfw_score"] == pytest.approx(0.5)

    def test_auto_rejected_emits_rejected_event_no_promotion(self, consumer):
        payload = self._make_payload()
        consumer._moderator.analyze_video.return_value = 0.9
        consumer._storage.download = MagicMock()

        with patch("app.consumer.update_video_moderation"), \
             patch("os.path.exists", return_value=False):
            consumer._process_message(payload)

        consumer._storage.promote_to_public.assert_not_called()
        consumer._producer.send_video_rejected.assert_called_once()
        call_kwargs = consumer._producer.send_video_rejected.call_args.kwargs
        assert call_kwargs["nsfw_score"] == pytest.approx(0.9)
        assert call_kwargs["video_id"] == "vid-123"

    def test_db_update_called_with_correct_args(self, consumer):
        payload = self._make_payload()
        consumer._moderator.analyze_video.return_value = 0.1
        consumer._storage.download = MagicMock()

        with patch("app.consumer.update_video_moderation") as mock_db, \
             patch("os.path.exists", return_value=False):
            consumer._process_message(payload)

        mock_db.assert_called_once_with(
            video_id="vid-123",
            nsfw_score=pytest.approx(0.1),
            verdict=_VERDICT_AUTO_APPROVED,
        )


# ---------------------------------------------------------------------------
# Retry / DLT tests
# ---------------------------------------------------------------------------

class TestRetryAndDlt:
    def test_retries_on_failure_then_succeeds(self, consumer):
        payload = {"videoId": "vid-retry", "objectKey": "videos/vid-retry.mp4"}
        call_count = {"n": 0}

        def flaky_process(p):
            call_count["n"] += 1
            if call_count["n"] < 2:
                raise RuntimeError("transient error")

        consumer._process_message = flaky_process

        message = MagicMock()
        message.value = payload
        message.key = b"vid-retry"

        consumer._handle_with_retry(message)
        assert call_count["n"] == 2

    def test_sends_to_dlt_after_all_retries_exhausted(self, consumer):
        payload = {"videoId": "vid-dlt", "objectKey": "videos/vid-dlt.mp4"}
        consumer._process_message = MagicMock(side_effect=RuntimeError("always fails"))

        message = MagicMock()
        message.value = payload
        message.key = b"vid-dlt"

        consumer._handle_with_retry(message)

        # 4 calls total: 1 initial + 3 retries
        assert consumer._process_message.call_count == 4
        consumer._producer.send_to_dlt.assert_called_once()
        dlt_kwargs = consumer._producer.send_to_dlt.call_args
        assert "always fails" in dlt_kwargs.kwargs["error"]
