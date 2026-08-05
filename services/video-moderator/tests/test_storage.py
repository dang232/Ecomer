from unittest.mock import MagicMock, call

from app.storage import StorageClient


def test_promote_many_copies_every_object_before_deleting_staged_files():
    storage = object.__new__(StorageClient)
    storage._staging_bucket = "vnshop-videos-staging"
    storage._public_bucket = "vnshop-videos"
    storage._s3 = MagicMock()

    storage.promote_many_to_public(["videos/clip.mp4", "videos/clip.jpg"])

    assert storage._s3.mock_calls == [
        call.copy_object(
            CopySource={"Bucket": "vnshop-videos-staging", "Key": "videos/clip.mp4"},
            Bucket="vnshop-videos",
            Key="videos/clip.mp4",
        ),
        call.copy_object(
            CopySource={"Bucket": "vnshop-videos-staging", "Key": "videos/clip.jpg"},
            Bucket="vnshop-videos",
            Key="videos/clip.jpg",
        ),
        call.delete_object(Bucket="vnshop-videos-staging", Key="videos/clip.mp4"),
        call.delete_object(Bucket="vnshop-videos-staging", Key="videos/clip.jpg"),
    ]
