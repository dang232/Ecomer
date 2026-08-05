"""MinIO / S3-compatible storage client for staging and public video buckets."""

import logging
import os
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import Settings

logger = logging.getLogger(__name__)


class StorageClient:
    def __init__(self, settings: Settings) -> None:
        self._staging_bucket = settings.storage_bucket_staging
        self._public_bucket = settings.storage_bucket_public

        kwargs: dict = {
            "endpoint_url": settings.storage_endpoint,
            "aws_access_key_id": settings.storage_access_key,
            "aws_secret_access_key": settings.storage_secret_key,
            "config": Config(signature_version="s3v4"),
        }
        if settings.storage_region and settings.storage_region != "auto":
            kwargs["region_name"] = settings.storage_region

        self._s3 = boto3.client("s3", **kwargs)

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    def download(self, object_key: str, local_path: str) -> None:
        """Download *object_key* from the staging bucket to *local_path*."""
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        logger.debug("Downloading s3://%s/%s → %s", self._staging_bucket, object_key, local_path)
        self._s3.download_file(self._staging_bucket, object_key, local_path)

    # ------------------------------------------------------------------
    # Move staging → public
    # ------------------------------------------------------------------

    def promote_to_public(self, object_key: str) -> None:
        """Copy *object_key* from staging to public storage."""
        self.promote_many_to_public([object_key])

    def promote_many_to_public(self, object_keys: list[str]) -> None:
        """Copy every asset before deleting any source to keep paired media recoverable."""
        keys = list(dict.fromkeys(object_keys))
        for object_key in keys:
            logger.info(
                "Promoting s3://%s/%s → s3://%s/%s",
                self._staging_bucket,
                object_key,
                self._public_bucket,
                object_key,
            )
            self._s3.copy_object(
                CopySource={"Bucket": self._staging_bucket, "Key": object_key},
                Bucket=self._public_bucket,
                Key=object_key,
            )
        for object_key in keys:
            self._s3.delete_object(Bucket=self._staging_bucket, Key=object_key)

    # ------------------------------------------------------------------
    # Bucket existence check (used at startup)
    # ------------------------------------------------------------------

    def ensure_buckets_exist(self) -> None:
        for bucket in (self._staging_bucket, self._public_bucket):
            try:
                self._s3.head_bucket(Bucket=bucket)
            except ClientError as exc:
                error_code = exc.response["Error"]["Code"]
                if error_code in ("404", "NoSuchBucket"):
                    self._s3.create_bucket(Bucket=bucket)
                    logger.info("Created bucket: %s", bucket)
                else:
                    raise
