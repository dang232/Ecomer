package com.vnshop.userservice.infrastructure.storage;

import com.vnshop.userservice.domain.port.out.ObjectStoragePort;
import com.vnshop.userservice.domain.storage.AvatarObjectMetadata;

import java.net.URI;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@RequiredArgsConstructor
public class S3ObjectStorageAdapter implements ObjectStoragePort {
    static final String IMMUTABLE_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
    static final String METADATA_SHA256 = "sha256";

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final ObjectStorageProperties properties;

    @Override
    public URI getSignedUploadUrl(String key, AvatarObjectMetadata metadata, Duration ttl) {
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(key)
                .contentType(metadata.contentType())
                .contentLength(metadata.contentLength())
                .cacheControl(IMMUTABLE_IMAGE_CACHE_CONTROL)
                .metadata(toS3Metadata(metadata))
                .build();
        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .putObjectRequest(putObjectRequest)
                .signatureDuration(ttl)
                .build();
        return URI.create(s3Presigner.presignPutObject(presignRequest).url().toString());
    }

    @Override
    public URI publicUrl(String key) {
        // Avatar bucket has anonymous download policy so this is directly
        // resolvable from the browser without signing — and crucially, doesn't
        // expire, so the BuyerProfile.avatarUrl can be cached forever.
        //
        // Path-style (MinIO):  {publicEndpoint}/{bucket}/{key}
        // Virtual-hosted (R2): {publicEndpoint}/{key}  (bucket is in hostname)
        String base = properties.resolvePublicEndpoint();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
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
    public Optional<AvatarObjectMetadata> headObject(String key) {
        try {
            HeadObjectResponse response = s3Client.headObject(HeadObjectRequest.builder().bucket(properties.getBucket()).key(key).build());
            Map<String, String> metadata = response.metadata();
            return Optional.of(new AvatarObjectMetadata(
                    key,
                    response.contentType(),
                    response.contentLength(),
                    metadata.get(METADATA_SHA256)));
        } catch (NoSuchKeyException ex) {
            return Optional.empty();
        }
    }

    private Map<String, String> toS3Metadata(AvatarObjectMetadata metadata) {
        Map<String, String> s3Metadata = new HashMap<>();
        s3Metadata.put(METADATA_SHA256, metadata.sha256Hex());
        return s3Metadata;
    }
}
