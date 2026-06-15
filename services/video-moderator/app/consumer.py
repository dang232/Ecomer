"""Kafka consumer for video.transcode.completed events.

Workflow per message:
1. Download transcoded MP4 from vnshop-videos-staging.
2. Extract frames (1 per 5 s) via ffmpeg.
3. Run NudeNet ONNX inference on each frame.
4. Compute MAX score across all frames.
5. Apply thresholds:
   - score < 0.3  → AUTO_APPROVED  : move staging → public, emit video.moderation.completed
   - 0.3–0.7      → PENDING_REVIEW : leave in staging, emit video.moderation.completed (verdict=PENDING_REVIEW)
   - score > 0.7  → AUTO_REJECTED  : keep in staging 7 days, emit video.rejected
6. Update DB record with nsfw_score + moderation_verdict.

Retry policy: 3 attempts with back-off [10s, 30s, 120s], then DLT.
"""

import asyncio
import json
import logging
import os
import tempfile
import time
import uuid
from typing import Any

from kafka import KafkaConsumer
from kafka.errors import KafkaError

from app.config import Settings
from app.db import update_video_moderation
from app.moderator import Moderator
from app.producer import ModerationProducer
from app.storage import StorageClient

logger = logging.getLogger(__name__)

_VERDICT_AUTO_APPROVED = "AUTO_APPROVED"
_VERDICT_PENDING_REVIEW = "PENDING_REVIEW"
_VERDICT_AUTO_REJECTED = "AUTO_REJECTED"


def _build_consumer(settings: Settings) -> KafkaConsumer:
    kwargs: dict[str, Any] = {
        "bootstrap_servers": settings.kafka_bootstrap_servers.split(","),
        "group_id": settings.kafka_consumer_group,
        "value_deserializer": lambda v: json.loads(v.decode("utf-8")),
        "key_deserializer": lambda k: k.decode("utf-8") if k else None,
        "auto_offset_reset": "earliest",
        "enable_auto_commit": False,
        "max_poll_interval_ms": 600_000,  # 10 min — analysis can be slow
    }
    if settings.kafka_security_protocol != "PLAINTEXT":
        kwargs.update(
            {
                "security_protocol": settings.kafka_security_protocol,
                "sasl_mechanism": settings.kafka_sasl_mechanism,
                "sasl_plain_username": settings.kafka_sasl_username,
                "sasl_plain_password": settings.kafka_sasl_password,
            }
        )
    consumer = KafkaConsumer(settings.kafka_topic_consume, **kwargs)
    return consumer


class ModerationConsumer:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._running = False
        self._consumer: KafkaConsumer | None = None
        self._producer = ModerationProducer(settings)
        self._storage = StorageClient(settings)
        self._moderator = Moderator(settings)

    async def start(self) -> None:
        self._running = True
        self._consumer = _build_consumer(self._settings)
        logger.info(
            "Consuming from topic=%s group=%s",
            self._settings.kafka_topic_consume,
            self._settings.kafka_consumer_group,
        )
        loop = asyncio.get_event_loop()
        try:
            while self._running:
                # Poll is blocking — run in executor to avoid blocking the event loop.
                records = await loop.run_in_executor(
                    None, lambda: self._consumer.poll(timeout_ms=1000)
                )
                for _tp, messages in records.items():
                    for message in messages:
                        await loop.run_in_executor(
                            None, self._handle_with_retry, message
                        )
                        self._consumer.commit()
        except asyncio.CancelledError:
            logger.info("Consumer task cancelled")
        finally:
            if self._consumer:
                self._consumer.close()
            self._producer.close()

    async def stop(self) -> None:
        self._running = False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _handle_with_retry(self, message) -> None:
        payload: dict = message.value or {}
        # Spec: 3 attempts total with backoff [30s, 120s] between attempts.
        # First attempt runs immediately; the delays list is applied between attempts
        # so len(delays) = max_attempts - 1.
        max_attempts: int = len(self._settings.retry_delays) + 1
        delays: list[int] = list(self._settings.retry_delays)
        last_exc: Exception | None = None

        for attempt in range(max_attempts):
            try:
                self._process_message(payload)
                return
            except Exception as exc:
                last_exc = exc
                if attempt < max_attempts - 1:
                    wait = delays[attempt]
                    logger.warning(
                        "Attempt %d/%d failed for videoId=%s — retrying in %ds: %s",
                        attempt + 1,
                        max_attempts,
                        payload.get("videoId"),
                        wait,
                        exc,
                    )
                    time.sleep(wait)
                else:
                    logger.error(
                        "All %d attempts exhausted for videoId=%s — sending to DLT",
                        max_attempts,
                        payload.get("videoId"),
                        exc_info=True,
                    )
                    self._producer.send_to_dlt(
                        original_key=(str(message.key) if message.key is not None else ""),
                        payload=payload,
                        error=str(last_exc),
                    )

    def _process_message(self, payload: dict) -> None:
        video_id: str = payload["videoId"]
        object_key: str = payload["objectKey"]

        logger.info("Processing moderation for videoId=%s key=%s", video_id, object_key)

        # 1. Download from staging bucket
        local_path = os.path.join(
            self._settings.tmp_dir,
            f"{uuid.uuid4().hex}_{os.path.basename(object_key)}",
        )
        try:
            self._storage.download(object_key, local_path)

            # 2–4. Extract frames + run NudeNet inference
            nsfw_score = self._moderator.analyze_video(local_path)
        finally:
            if os.path.exists(local_path):
                os.remove(local_path)

        # 5. Apply thresholds
        verdict = self._classify(nsfw_score)
        logger.info(
            "videoId=%s nsfw_score=%.4f verdict=%s",
            video_id,
            nsfw_score,
            verdict,
        )

        if verdict == _VERDICT_AUTO_APPROVED:
            self._storage.promote_to_public(object_key)
            self._producer.send_moderation_completed(
                video_id=video_id,
                object_key=object_key,
                nsfw_score=nsfw_score,
                verdict=verdict,
                public_bucket=self._settings.storage_bucket_public,
            )
        elif verdict == _VERDICT_PENDING_REVIEW:
            # Leave in staging; admin will approve/reject via the queue API.
            self._producer.send_pending_review(
                video_id=video_id,
                object_key=object_key,
                nsfw_score=nsfw_score,
            )
        else:  # AUTO_REJECTED
            # Keep in staging for 7 days (lifecycle rule on the bucket).
            self._producer.send_video_rejected(
                video_id=video_id,
                object_key=object_key,
                nsfw_score=nsfw_score,
                reason="NSFW score exceeded AUTO_REJECTED threshold",
            )

        # 6. Update DB
        update_video_moderation(
            video_id=video_id,
            nsfw_score=nsfw_score,
            verdict=verdict,
        )

    def _classify(self, score: float) -> str:
        if score < self._settings.nsfw_threshold_auto_approve:
            return _VERDICT_AUTO_APPROVED
        if score <= self._settings.nsfw_threshold_auto_reject:
            return _VERDICT_PENDING_REVIEW
        return _VERDICT_AUTO_REJECTED
