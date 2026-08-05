package com.vnshop.productservice.infrastructure.storage;

import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.storage.ObjectMetadata;
import com.vnshop.productservice.domain.storage.ObjectQuarantineState;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import java.io.InputStream;
import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@RequiredArgsConstructor
public class S3ObjectStorageAdapter implements ObjectStoragePort {
    static final String METADATA_STORAGE_CLASS = "storage-class";
    static final String METADATA_SHA256 = "sha256";
    static final String METADATA_QUARANTINE_STATE = "quarantine-state";
    static final String METADATA_IMAGE_WIDTH = "image-width";
    static final String METADATA_IMAGE_HEIGHT = "image-height";

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final ObjectStorageProperties properties;
    private final VideoStorageProperties videoStorageProperties;

    @Override
    public void putObject(String key, InputStream content, ObjectMetadata metadata) {
        PutObjectRequest request = putObjectRequest(key, metadata).build();
        s3Client.putObject(request, RequestBody.fromInputStream(content, metadata.getContentLength()));
    }

    @Override
    public URI getSignedUploadUrl(String key, ObjectMetadata metadata) {
        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .putObjectRequest(putObjectRequest(key, metadata).build())
                .signatureDuration(metadata.getStorageClass().uploadTtl())
                .build();
        return URI.create(s3Presigner.presignPutObject(presignRequest).url().toString());
    }

    @Override
    public URI getSignedDownloadUrl(String key, ObjectStorageClass storageClass) {
        BucketKey object = parse(key, storageClass);
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .getObjectRequest(GetObjectRequest.builder().bucket(object.bucket()).key(object.key()).build())
                .signatureDuration(storageClass.downloadTtl())
                .build();
        return URI.create(s3Presigner.presignGetObject(presignRequest).url().toString());
    }

    @Override
    public URI publicUrl(String key) {
        BucketKey object = parse(key, null);
        String base = properties.resolvePublicEndpoint().replaceAll("/$", "");
        if (properties.isPathStyleAccess()) {
            return URI.create(base + "/" + object.bucket() + "/" + object.key());
        }
        return URI.create(base + "/" + object.key());
    }

    @Override
    public void deleteObject(String key) {
        BucketKey object = parse(key, null);
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(object.bucket()).key(object.key()).build());
    }

    @Override
    public void copyObject(String sourceKey, String destinationKey) {
        BucketKey src = parse(sourceKey, null);
        BucketKey dst = parse(destinationKey, null);
        s3Client.copyObject(CopyObjectRequest.builder()
                .sourceBucket(src.bucket())
                .sourceKey(src.key())
                .destinationBucket(dst.bucket())
                .destinationKey(dst.key())
                .build());
    }

    @Override
    public Optional<ObjectMetadata> headObject(String key) {
        try {
            BucketKey object = parse(key, null);
            HeadObjectResponse response = s3Client.headObject(
                    HeadObjectRequest.builder().bucket(object.bucket()).key(object.key()).build());
            Map<String, String> metadata = response.metadata();
            return Optional.of(ObjectMetadata.builder()
                    .key(key)
                    .storageClass(ObjectStorageClass.valueOf(metadata.get(METADATA_STORAGE_CLASS)))
                    .contentType(response.contentType())
                    .contentLength(response.contentLength())
                    .sha256Hex(metadata.get(METADATA_SHA256))
                    .quarantineState(ObjectQuarantineState.valueOf(metadata.get(METADATA_QUARANTINE_STATE)))
                    .imageWidth(parseInteger(metadata.get(METADATA_IMAGE_WIDTH)))
                    .imageHeight(parseInteger(metadata.get(METADATA_IMAGE_HEIGHT)))
                    .createdAt(Optional.ofNullable(response.lastModified()).orElse(Instant.EPOCH))
                    .build());
        } catch (NoSuchKeyException ex) {
            return Optional.empty();
        }
    }

    private PutObjectRequest.Builder putObjectRequest(String key, ObjectMetadata metadata) {
        BucketKey object = parse(key, metadata.getStorageClass());
        return PutObjectRequest.builder()
                .bucket(object.bucket())
                .key(object.key())
                .contentType(metadata.getContentType())
                .contentLength(metadata.getContentLength())
                .metadata(toS3Metadata(metadata));
    }

    private Map<String, String> toS3Metadata(ObjectMetadata metadata) {
        Map<String, String> s3Metadata = new HashMap<>();
        s3Metadata.put(METADATA_STORAGE_CLASS, metadata.getStorageClass().name());
        s3Metadata.put(METADATA_SHA256, metadata.getSha256Hex());
        s3Metadata.put(METADATA_QUARANTINE_STATE, metadata.getQuarantineState().name());
        if (metadata.getImageWidth() != null) {
            s3Metadata.put(METADATA_IMAGE_WIDTH, metadata.getImageWidth().toString());
        }
        if (metadata.getImageHeight() != null) {
            s3Metadata.put(METADATA_IMAGE_HEIGHT, metadata.getImageHeight().toString());
        }
        return s3Metadata;
    }

    private Integer parseInteger(String value) {
        return value == null ? null : Integer.valueOf(value);
    }

    private BucketKey parse(String raw, ObjectStorageClass storageClass) {
        return BucketKey.parse(raw, properties.getBucket(), properties.getReviewBucket(), storageClass, Set.of(
                properties.getBucket(),
                properties.getReviewBucket(),
                videoStorageProperties.inputBucket(),
                videoStorageProperties.stagingBucket(),
                videoStorageProperties.publicBucket()));
    }

    private record BucketKey(String bucket, String key) {
        static BucketKey parse(String raw, String defaultBucket, String reviewBucket,
                ObjectStorageClass storageClass, Set<String> knownBuckets) {
            int slash = raw.indexOf("/");
            if (slash > 0 && knownBuckets.contains(raw.substring(0, slash))) {
                return new BucketKey(raw.substring(0, slash), raw.substring(slash + 1));
            }
            if (storageClass == ObjectStorageClass.REVIEW_IMAGE || raw.startsWith("reviews/")) {
                return new BucketKey(reviewBucket, raw);
            }
            return new BucketKey(defaultBucket, raw);
        }
    }
}
