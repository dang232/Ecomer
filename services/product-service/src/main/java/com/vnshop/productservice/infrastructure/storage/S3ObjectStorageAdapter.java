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
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .getObjectRequest(GetObjectRequest.builder().bucket(properties.getBucket()).key(key).build())
                .signatureDuration(storageClass.downloadTtl())
                .build();
        return URI.create(s3Presigner.presignGetObject(presignRequest).url().toString());
    }

    @Override
    public URI publicUrl(String key) {
        String base = properties.resolvePublicEndpoint().replaceAll("/$", "");
        if (properties.isPathStyleAccess()) {
            return URI.create(base + "/" + properties.getBucket() + "/" + key);
        }
        return URI.create(base + "/" + key);
    }

    @Override
    public void deleteObject(String key) {
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(properties.getBucket()).key(key).build());
    }

    @Override
    public void copyObject(String sourceKey, String destinationKey) {
        BucketKey src = BucketKey.parse(sourceKey, properties.getBucket());
        BucketKey dst = BucketKey.parse(destinationKey, properties.getBucket());
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
            HeadObjectResponse response = s3Client.headObject(
                    HeadObjectRequest.builder().bucket(properties.getBucket()).key(key).build());
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
        return PutObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(key)
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

    private record BucketKey(String bucket, String key) {
        static BucketKey parse(String raw, String defaultBucket) {
            int slash = raw.indexOf("/");
            if (slash > 0) {
                return new BucketKey(raw.substring(0, slash), raw.substring(slash + 1));
            }
            return new BucketKey(defaultBucket, raw);
        }
    }
}
