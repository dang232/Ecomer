package com.vnshop.productservice.domain.video;

public enum VideoStatus {
    UPLOADING,
    UPLOADED,
    TRANSCODING,
    TRANSCODED,
    MODERATING,
    PENDING_REVIEW,
    APPROVED,
    PUBLISHED,
    REJECTED,
    APPEAL_PENDING,
    FAILED,
    DELETED
}
