package com.vnshop.productservice.application.review.image;

import com.vnshop.productservice.application.ProductAccessDeniedException;
import com.vnshop.productservice.application.storage.ObjectValidationRequest;
import com.vnshop.productservice.application.storage.ObjectValidationService;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.storage.ObjectMetadata;
import com.vnshop.productservice.domain.storage.ObjectQuarantineState;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import com.vnshop.productservice.domain.storage.ObjectValidationResult;
import java.net.URI;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class ReviewImageUploadService {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final ReviewRepositoryPort reviewRepositoryPort;
    private final ObjectStoragePort objectStoragePort;
    private final ObjectMetadataRepositoryPort objectMetadataRepositoryPort;
    private final ObjectValidationService objectValidationService;

    public ReviewImageUploadResponse createUpload(ReviewImageUploadRequest request) {
        Review review = reviewRepositoryPort.findReviewById(UUID.fromString(request.reviewId()))
                .orElseThrow(() -> new IllegalArgumentException("review not found"));
        if (!review.buyerId().equals(request.buyerId())) {
            throw new IllegalArgumentException("review not found");
        }

        ObjectMetadata metadata = metadata(request, objectKey(request));
        ObjectValidationResult result = validate(request, metadata);
        if (!result.active()) {
            objectMetadataRepositoryPort.save(metadata.toBuilder()
                    .quarantineState(ObjectQuarantineState.REJECTED)
                    .build());
            throw new ReviewImageValidationException(result.getFailures());
        }

        ObjectMetadata pending = objectMetadataRepositoryPort.save(metadata);
        URI uploadUrl = objectStoragePort.getSignedUploadUrl(pending.getKey(), pending);
        return new ReviewImageUploadResponse(
                pending.getKey(),
                uploadUrl,
                uploadHeaders(pending),
                pending.getSha256Hex(),
                pending.getQuarantineState().name(),
                ObjectStorageClass.REVIEW_IMAGE.uploadTtl().toSeconds());
    }

    public ReviewImageActivationResponse activate(String reviewId, String buyerId, String objectKey, ReviewImageActivationRequest request) {
        Review review = reviewRepositoryPort.findReviewById(UUID.fromString(reviewId))
                .orElseThrow(() -> new ProductAccessDeniedException("review not found or not owned by caller"));
        if (!review.buyerId().equals(buyerId)) {
            throw new ProductAccessDeniedException("review not found or not owned by caller");
        }
        if (!objectKey.startsWith("reviews/" + reviewId + "/")) {
            throw new ProductAccessDeniedException("objectKey does not belong to review " + reviewId);
        }
        ObjectMetadata metadata = objectMetadataRepositoryPort.findByKey(objectKey)
                .orElseThrow(() -> new IllegalArgumentException("object metadata not found"));
        ObjectMetadata storedObject = objectStoragePort.headObject(objectKey)
                .orElseThrow(() -> new IllegalArgumentException("uploaded review image object not found"));
        if (!Objects.equals(storedObject.getContentType(), metadata.getContentType())
                || storedObject.getContentLength() != metadata.getContentLength()
                || !Objects.equals(storedObject.getSha256Hex(), metadata.getSha256Hex())
                || !Objects.equals(storedObject.getImageWidth(), metadata.getImageWidth())
                || !Objects.equals(storedObject.getImageHeight(), metadata.getImageHeight())) {
            throw new IllegalArgumentException("uploaded review image metadata does not match upload declaration");
        }
        if (storedObject.getContentLength() != request.contentLength()
                || !Objects.equals(storedObject.getSha256Hex(), request.sha256Hex())
                || !Objects.equals(storedObject.getImageWidth(), request.imageWidth())
                || !Objects.equals(storedObject.getImageHeight(), request.imageHeight())) {
            throw new IllegalArgumentException("uploaded review image metadata does not match activation request");
        }
        ObjectValidationResult result = objectValidationService.validate(ObjectValidationRequest.builder()
                .metadata(storedObject)
                .expectedSha256Hex(metadata.getSha256Hex())
                .detectedContentType(request.detectedContentType())
                // Pt19 audit: avScanClean is no longer accepted on the wire —
                // see ProductImageUploadService.activate for the rationale.
                .avScanClean(true)
                .build());
        ObjectMetadata activated = metadata.toBuilder()
                .contentLength(request.contentLength())
                .sha256Hex(request.sha256Hex())
                .imageWidth(request.imageWidth())
                .imageHeight(request.imageHeight())
                .quarantineState(result.active() ? ObjectQuarantineState.ACTIVE : ObjectQuarantineState.REJECTED)
                .build();
        objectMetadataRepositoryPort.save(activated);
        if (!result.active()) {
            throw new ReviewImageValidationException(result.getFailures());
        }
        URI publicUrl = objectStoragePort.publicUrl(activated.getKey());
        reviewRepositoryPort.save(review.withImage(publicUrl.toString()));
        return new ReviewImageActivationResponse(
                activated.getKey(),
                activated.getQuarantineState().name(),
                activated.getSha256Hex(),
                publicUrl);
    }

    private Map<String, String> uploadHeaders(ObjectMetadata metadata) {
        return Map.of(
                "Content-Type", metadata.getContentType(),
                "x-amz-meta-storage-class", metadata.getStorageClass().name(),
                "x-amz-meta-sha256", metadata.getSha256Hex(),
                "x-amz-meta-quarantine-state", metadata.getQuarantineState().name(),
                "x-amz-meta-image-width", metadata.getImageWidth().toString(),
                "x-amz-meta-image-height", metadata.getImageHeight().toString());
    }

    private ObjectValidationResult validate(ReviewImageUploadRequest request, ObjectMetadata metadata) {
        ReviewImageValidationFailures failures = new ReviewImageValidationFailures();
        validateExtension(request.fileName(), failures);
        validateDeclaredContentType(request.declaredContentType(), failures);
        validateChecksumShape(request.sha256Hex(), failures);
        if (request.imageWidth() == null || request.imageHeight() == null) {
            failures.add("image_dimensions_required");
        }
        if (!failures.empty()) {
            return failures.toResult();
        }
        return objectValidationService.validate(ObjectValidationRequest.builder()
                .metadata(metadata)
                .expectedSha256Hex(request.sha256Hex())
                .detectedContentType(request.detectedContentType())
                .avScanClean(true)
                .build());
    }

    private ObjectMetadata metadata(ReviewImageUploadRequest request, String key) {
        return ObjectMetadata.builder()
                .key(key)
                .storageClass(ObjectStorageClass.REVIEW_IMAGE)
                .contentType(request.detectedContentType())
                .contentLength(request.contentLength())
                .sha256Hex(request.sha256Hex())
                .quarantineState(ObjectQuarantineState.PENDING_VALIDATION)
                .imageWidth(request.imageWidth())
                .imageHeight(request.imageHeight())
                .createdAt(Instant.now())
                .build();
    }

    private String objectKey(ReviewImageUploadRequest request) {
        return "reviews/%s/images/%s.%s".formatted(request.reviewId(), UUID.randomUUID(), extension(request.fileName()));
    }

    private void validateExtension(String fileName, ReviewImageValidationFailures failures) {
        if (!ALLOWED_EXTENSIONS.contains(extension(fileName))) {
            failures.add("file_extension_rejected");
        }
    }

    private void validateDeclaredContentType(String declaredContentType, ReviewImageValidationFailures failures) {
        if (!ALLOWED_CONTENT_TYPES.contains(declaredContentType)) {
            failures.add("declared_content_type_rejected");
        }
    }

    private void validateChecksumShape(String sha256Hex, ReviewImageValidationFailures failures) {
        if (sha256Hex == null || !sha256Hex.matches("[a-fA-F0-9]{64}")) {
            failures.add("checksum_shape_invalid");
        }
    }

    private String extension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private static final class ReviewImageValidationFailures {
        private final java.util.List<String> values = new java.util.ArrayList<>();

        void add(String failure) {
            values.add(failure);
        }

        boolean empty() {
            return values.isEmpty();
        }

        ObjectValidationResult toResult() {
            return ObjectValidationResult.builder()
                    .quarantineState(ObjectQuarantineState.REJECTED)
                    .failures(java.util.List.copyOf(values))
                    .build();
        }
    }

}
