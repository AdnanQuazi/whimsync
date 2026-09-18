from pathlib import Path

import boto3
from botocore.client import Config

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger("storage_service")


class StorageService:
    def __init__(self):
        self.bucket = settings.MINIO_BUCKET
        s3_config = Config(
            s3={"addressing_style": "path"},
            signature_version="s3v4",
        )
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.minio_url,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name=settings.MINIO_REGION,
            config=s3_config,
        )

    def download_file(self, storage_key: str, destination_path: Path) -> Path:
        """Downloads an object from S3/MinIO to a local destination."""
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info(f"Downloading s3://{self.bucket}/{storage_key} -> {destination_path}")
        self.client.download_file(self.bucket, storage_key, str(destination_path))
        return destination_path

    def upload_file(
        self,
        local_path: Path,
        storage_key: str,
        content_type: str | None = None,
    ) -> str:
        """Uploads a local file to S3/MinIO and returns the storage key."""
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type

        logger.info(f"Uploading {local_path} -> s3://{self.bucket}/{storage_key}")
        self.client.upload_file(
            str(local_path),
            self.bucket,
            storage_key,
            ExtraArgs=extra_args if extra_args else None,
        )
        return storage_key

    def upload_bytes(
        self,
        data: bytes,
        storage_key: str,
        content_type: str | None = None,
    ) -> str:
        """Uploads raw bytes to S3/MinIO and returns the storage key."""
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type

        logger.info(f"Uploading {len(data)} bytes -> s3://{self.bucket}/{storage_key}")
        self.client.put_object(
            Bucket=self.bucket,
            Key=storage_key,
            Body=data,
            **extra_args,
        )
        return storage_key


storage_service = StorageService()
