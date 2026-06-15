"""Environment-based configuration for the video-moderator service."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Kafka
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_consumer_group: str = "moderator-worker"
    kafka_topic_consume: str = "video.transcode.completed"
    kafka_topic_moderation_completed: str = "video.moderation.completed"
    kafka_topic_rejected: str = "video.rejected"
    kafka_topic_dlt: str = "video.moderation.dlt"
    kafka_security_protocol: str = "PLAINTEXT"
    kafka_sasl_mechanism: str = "PLAIN"
    kafka_sasl_username: str = ""
    kafka_sasl_password: str = ""

    # Retry back-off delays in seconds between attempts.
    # Spec section 10: 3 attempts total, backoff 30s then 120s.
    # delays.len = max_attempts - 1 (delays applied BETWEEN attempts, not after the last).
    retry_delays: list[int] = [30, 120]

    # Object storage (MinIO / R2)
    storage_endpoint: str = "http://minio:9000"
    storage_access_key: str = "vnshop"
    storage_secret_key: str = "vnshop123"
    storage_region: str = "auto"
    storage_bucket_staging: str = "vnshop-videos-staging"
    storage_bucket_public: str = "vnshop-videos"

    # Moderation thresholds
    nsfw_threshold_auto_approve: float = 0.3
    nsfw_threshold_auto_reject: float = 0.7

    # Frame extraction: 1 frame every N seconds
    frame_interval_seconds: int = 5

    # Database (for updating nsfw_score / moderation_verdict)
    database_url: str = "postgresql://vnshop:vnshop@postgres-product:5432/vnshop_product"

    # Temp directory for frame extraction
    tmp_dir: str = "/tmp/video-moderator"

    # Service
    host: str = "0.0.0.0"
    port: int = 8100
    log_level: str = "INFO"

    class Config:
        env_prefix = "MODERATOR_"
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
