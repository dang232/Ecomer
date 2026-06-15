"""Kafka producer for moderation outcome events."""

import json
import logging
import socket
from datetime import datetime, timezone
from typing import Any

from kafka import KafkaProducer
from kafka.errors import KafkaError

from app.config import Settings

logger = logging.getLogger(__name__)


def _build_producer(settings: Settings) -> KafkaProducer:
    kwargs: dict[str, Any] = {
        "bootstrap_servers": settings.kafka_bootstrap_servers.split(","),
        "value_serializer": lambda v: json.dumps(v).encode("utf-8"),
        "key_serializer": lambda k: k.encode("utf-8") if k else None,
        "acks": "all",
        "retries": 5,
        "client_id": f"video-moderator-{socket.gethostname()}",
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
    return KafkaProducer(**kwargs)


class ModerationProducer:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._producer = _build_producer(settings)

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def send_moderation_completed(
        self,
        *,
        video_id: str,
        object_key: str,
        nsfw_score: float,
        verdict: str,
        public_bucket: str,
    ) -> None:
        payload = {
            "eventType": "video.moderation.completed",
            "videoId": video_id,
            "objectKey": object_key,
            "nsfwScore": nsfw_score,
            "verdict": verdict,
            "publicBucket": public_bucket,
            "occurredAt": self._now_iso(),
        }
        self._send(self._settings.kafka_topic_moderation_completed, video_id, payload)

    def send_video_rejected(
        self,
        *,
        video_id: str,
        object_key: str,
        nsfw_score: float,
        reason: str,
    ) -> None:
        payload = {
            "eventType": "video.rejected",
            "videoId": video_id,
            "objectKey": object_key,
            "nsfwScore": nsfw_score,
            "reason": reason,
            "occurredAt": self._now_iso(),
        }
        self._send(self._settings.kafka_topic_rejected, video_id, payload)

    def send_pending_review(
        self,
        *,
        video_id: str,
        object_key: str,
        nsfw_score: float,
    ) -> None:
        """Emit moderation.completed with verdict=PENDING_REVIEW for the admin queue."""
        payload = {
            "eventType": "video.moderation.completed",
            "videoId": video_id,
            "objectKey": object_key,
            "nsfwScore": nsfw_score,
            "verdict": "PENDING_REVIEW",
            "occurredAt": self._now_iso(),
        }
        self._send(self._settings.kafka_topic_moderation_completed, video_id, payload)

    def send_to_dlt(self, original_key: str, payload: dict, error: str) -> None:
        dlt_payload = {
            "originalKey": original_key,
            "payload": payload,
            "error": error,
            "occurredAt": self._now_iso(),
        }
        self._send(self._settings.kafka_topic_dlt, original_key, dlt_payload)

    def _send(self, topic: str, key: str, payload: dict) -> None:
        try:
            future = self._producer.send(topic, key=key, value=payload)
            future.get(timeout=10)
            logger.debug("Sent %s to %s", payload.get("eventType"), topic)
        except KafkaError:
            logger.exception("Failed to send message to topic %s", topic)
            raise

    def close(self) -> None:
        self._producer.flush()
        self._producer.close()
