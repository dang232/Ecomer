package com.vnshop.productservice.domain.port.out;

import com.vnshop.productservice.domain.storage.ObjectMetadata;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import java.io.InputStream;
import java.net.URI;
import java.util.Optional;

public interface ObjectStoragePort {
    void putObject(String key, InputStream content, ObjectMetadata metadata);

    URI getSignedUploadUrl(String key, ObjectMetadata metadata);

    URI getSignedDownloadUrl(String key, ObjectStorageClass storageClass);

    /**
     * Returns the unsigned public URL for an object in a bucket with anonymous
     * download policy. Unlike signed URLs, these never expire and are safe to
     * persist in the database (e.g. ProductImage.url).
     */
    URI publicUrl(String key);

    void deleteObject(String key);

    /**
     * Server-side copy from sourceKey to destinationKey.
     * Keys may be bucket-prefixed in "bucket/key" format for cross-bucket copies.
     */
    void copyObject(String sourceKey, String destinationKey);

    Optional<ObjectMetadata> headObject(String key);
}
