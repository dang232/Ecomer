package com.vnshop.productservice.application.image;

import com.vnshop.productservice.application.ProductAccessDeniedException;
import com.vnshop.productservice.application.storage.ObjectValidationPolicy;
import com.vnshop.productservice.application.storage.ObjectValidationRequest;
import com.vnshop.productservice.application.storage.ObjectValidationService;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
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
public class ProductImageUploadService {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final int MAX_IMAGE_WIDTH = 4096;
    private static final int MAX_IMAGE_HEIGHT = 4096;

    private final ProductRepositoryPort productRepositoryPort;
    private final ObjectStoragePort objectStoragePort;
    private final ObjectMetadataRepositoryPort objectMetadataRepositoryPort;
    private final ObjectValidationService objectValidationService;

    public ProductImageUploadResponse createUpload(ProductImageUploadRequest request) {
        Product product = productRepositoryPort.findById(UUID.fromString(request.productId()))
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
        if (!product.sellerId().equals(request.sellerId())) {
            throw new IllegalArgumentException("product not found");
        }

        ObjectMetadata metadata = metadata(request, objectKey(request));
        ObjectValidationResult result = validate(request, metadata);
        if (!result.active()) {
            objectMetadataRepositoryPort.save(metadata.toBuilder()
                    .quarantineState(ObjectQuarantineState.REJECTED)
                    .build());
            throw new ProductImageValidationException(result.getFailures());
        }

        ObjectMetadata pending = objectMetadataRepositoryPort.save(metadata);
        URI uploadUrl = objectStoragePort.getSignedUploadUrl(pending.getKey(), pending);
        return ProductImageUploadResponse.builder()
                .objectKey(pending.getKey())
                .uploadUrl(uploadUrl)
                .uploadHeaders(uploadHeaders(pending))
                .checksumSha256(pending.getSha256Hex())
                .quarantineState(pending.getQuarantineState().name())
                .expiresInSeconds(ObjectStorageClass.PRODUCT_IMAGE.uploadTtl().toSeconds())
                .build();
    }

    private Map<String, String> uploadHeaders(ObjectMetadata metadata) {
        return Map.of(
                "Content-Type", metadata.getContentType(),
                "Cache-Control", "public, max-age=31536000, immutable",
                "x-amz-meta-storage-class", metadata.getStorageClass().name(),
                "x-amz-meta-sha256", metadata.getSha256Hex(),
                "x-amz-meta-quarantine-state", metadata.getQuarantineState().name(),
                "x-amz-meta-image-width", metadata.getImageWidth().toString(),
                "x-amz-meta-image-height", metadata.getImageHeight().toString());
    }

    public ProductImageActivationResponse activate(String productId, String sellerId, String objectKey, ProductImageActivationRequest request) {
        Product product = productRepositoryPort.findById(UUID.fromString(productId))
                .orElseThrow(() -> new ProductAccessDeniedException("product not found or not owned by caller"));
        if (!product.sellerId().equals(sellerId)) {
            throw new ProductAccessDeniedException("product not found or not owned by caller");
        }
        if (!objectKey.startsWith("products/" + productId + "/")) {
            throw new ProductAccessDeniedException("objectKey does not belong to product " + productId);
        }
        ObjectMetadata metadata = objectMetadataRepositoryPort.findByKey(objectKey)
                .orElseThrow(() -> new IllegalArgumentException("object metadata not found"));
        ObjectMetadata storedObject = objectStoragePort.headObject(objectKey)
                .orElseThrow(() -> new IllegalArgumentException("uploaded image object not found"));
        if (!Objects.equals(storedObject.getContentType(), metadata.getContentType())
                || storedObject.getContentLength() != metadata.getContentLength()
                || !Objects.equals(storedObject.getSha256Hex(), metadata.getSha256Hex())
                || !Objects.equals(storedObject.getImageWidth(), metadata.getImageWidth())
                || !Objects.equals(storedObject.getImageHeight(), metadata.getImageHeight())) {
            throw new IllegalArgumentException("uploaded image metadata does not match upload declaration");
        }
        if (storedObject.getContentLength() != request.contentLength()
                || !Objects.equals(storedObject.getSha256Hex(), request.sha256Hex())
                || !Objects.equals(storedObject.getImageWidth(), request.imageWidth())
                || !Objects.equals(storedObject.getImageHeight(), request.imageHeight())) {
            throw new IllegalArgumentException("uploaded image metadata does not match activation request");
        }
        ObjectValidationResult result = objectValidationService.validate(ObjectValidationRequest.builder()
                .metadata(storedObject)
                .expectedSha256Hex(metadata.getSha256Hex())
                .detectedContentType(request.detectedContentType())
                // Pt19 audit: avScanClean is no longer accepted on the wire — a
                // hostile seller could trivially set it to true and bypass the
                // gate. Hardcoded here to match the createUpload path; if a real
                // AV scanner gets wired in, switch this to a server-side lookup
                // on ObjectMetadata.
                .avScanClean(true)
                .build());
        ObjectMetadata activated = metadata.toBuilder()
                .contentLength(storedObject.getContentLength())
                .sha256Hex(storedObject.getSha256Hex())
                .imageWidth(storedObject.getImageWidth())
                .imageHeight(storedObject.getImageHeight())
                .quarantineState(result.active() ? ObjectQuarantineState.ACTIVE : ObjectQuarantineState.REJECTED)
                .build();
        objectMetadataRepositoryPort.save(activated);
        if (!result.active()) {
            throw new ProductImageValidationException(result.getFailures());
        }
        return new ProductImageActivationResponse(
                activated.getKey(),
                activated.getSha256Hex(),
                activated.getQuarantineState().name(),
                objectStoragePort.publicUrl(activated.getKey()));
    }

    private ObjectValidationResult validate(ProductImageUploadRequest request, ObjectMetadata metadata) {
        ProductImageValidationFailures failures = new ProductImageValidationFailures();
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

    private ObjectMetadata metadata(ProductImageUploadRequest request, String key) {
        return ObjectMetadata.builder()
                .key(key)
                .storageClass(ObjectStorageClass.PRODUCT_IMAGE)
                .contentType(request.detectedContentType())
                .contentLength(request.contentLength())
                .sha256Hex(request.sha256Hex())
                .quarantineState(ObjectQuarantineState.PENDING_VALIDATION)
                .imageWidth(request.imageWidth())
                .imageHeight(request.imageHeight())
                .createdAt(Instant.now())
                .build();
    }

    private String objectKey(ProductImageUploadRequest request) {
        return "products/%s/images/%s.%s".formatted(request.productId(), UUID.randomUUID(), extension(request.fileName()));
    }

    private void validateExtension(String fileName, ProductImageValidationFailures failures) {
        if (!ALLOWED_EXTENSIONS.contains(extension(fileName))) {
            failures.add("file_extension_rejected");
        }
    }

    private void validateDeclaredContentType(String declaredContentType, ProductImageValidationFailures failures) {
        if (!ALLOWED_CONTENT_TYPES.contains(declaredContentType)) {
            failures.add("declared_content_type_rejected");
        }
    }

    private void validateChecksumShape(String sha256Hex, ProductImageValidationFailures failures) {
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

    private static final class ProductImageValidationFailures {
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
