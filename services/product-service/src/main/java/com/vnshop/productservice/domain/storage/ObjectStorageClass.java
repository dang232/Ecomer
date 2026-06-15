package com.vnshop.productservice.domain.storage;

import java.time.Duration;

public enum ObjectStorageClass {
    PRODUCT_IMAGE(Duration.ofMinutes(15), Duration.ofMinutes(15)),
    REVIEW_IMAGE(Duration.ofMinutes(15), Duration.ofMinutes(15)),
    SELLER_DOCUMENT(Duration.ofMinutes(15), Duration.ofMinutes(5)),
    INVOICE(Duration.ofMinutes(15), Duration.ofMinutes(5)),
    EXPORT(Duration.ofMinutes(15), Duration.ofMinutes(15)),
    // Staged video files awaiting transcoding/moderation — short-lived presigned download.
    VIDEO_STAGING(Duration.ofHours(1), Duration.ofMinutes(10));

    private final Duration uploadTtl;
    private final Duration downloadTtl;

    ObjectStorageClass(Duration uploadTtl, Duration downloadTtl) {
        this.uploadTtl = uploadTtl;
        this.downloadTtl = downloadTtl;
    }

    public Duration uploadTtl() {
        return uploadTtl;
    }

    public Duration downloadTtl() {
        return downloadTtl;
    }
}
