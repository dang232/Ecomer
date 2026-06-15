package com.vnshop.productservice.application.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.productservice.application.ProductAccessDeniedException;
import com.vnshop.productservice.application.storage.ObjectValidationPolicy;
import com.vnshop.productservice.application.storage.ObjectValidationService;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
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
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProductImageUploadServiceTest {
    private final FakeProductRepository productRepository = new FakeProductRepository();
    private final FakeObjectStorage objectStorage = new FakeObjectStorage();
    private final FakeObjectMetadataRepository metadataRepository = new FakeObjectMetadataRepository();
    private final ProductImageUploadService service = new ProductImageUploadService(productRepository, objectStorage,
            metadataRepository, new ObjectValidationService(ObjectValidationPolicy.builder()
                    .storageClass(ObjectStorageClass.PRODUCT_IMAGE)
                    .maxBytes(5 * 1024 * 1024)
                    .allowedContentTypes(Set.of("image/jpeg", "image/png", "image/webp"))
                    .maxImageWidth(4096)
                    .maxImageHeight(4096)
                    .build()));

    @Test
    void createsSignedUploadUrlAndPendingMetadataForValidProductImage() {
        productRepository.save(product(UUID.fromString("00000000-0000-0000-0000-000000000001"), "seller-1"));

        ProductImageUploadResponse response = service.createUpload(validRequest().build());

        assertThat(response.uploadUrl()).isEqualTo(URI.create("https://storage.test/" + response.objectKey()));
        assertThat(response.objectKey()).startsWith("products/00000000-0000-0000-0000-000000000001/images/").endsWith(".png");
        assertThat(response.checksumSha256()).isEqualTo("a".repeat(64));
        assertThat(response.quarantineState()).isEqualTo("PENDING_VALIDATION");
        ObjectMetadata metadata = metadataRepository.saved.get(response.objectKey());
        assertThat(metadata.getQuarantineState()).isEqualTo(ObjectQuarantineState.PENDING_VALIDATION);
        assertThat(metadata.getSha256Hex()).isEqualTo("a".repeat(64));
        assertThat(metadata.getContentType()).isEqualTo("image/png");
        assertThat(objectStorage.lastMetadata).isEqualTo(metadata);
    }

    @Test
    void rejectsInvalidMetadataBeforeIssuingUploadUrl() {
        productRepository.save(product(UUID.fromString("00000000-0000-0000-0000-000000000001"), "seller-1"));

        assertThatThrownBy(() -> service.createUpload(validRequest()
                .fileName("payload.exe")
                .declaredContentType("application/x-msdownload")
                .detectedContentType("application/x-msdownload")
                .contentLength(6 * 1024 * 1024)
                .sha256Hex("not-a-sha")
                .imageWidth(5000)
                .imageHeight(null)
                .build()))
                .isInstanceOf(ProductImageValidationException.class)
                .extracting(error -> ((ProductImageValidationException) error).failures())
                .asList()
                .contains("file_extension_rejected", "declared_content_type_rejected", "checksum_shape_invalid", "image_dimensions_required");
        assertThat(objectStorage.lastKey).isNull();
        assertThat(metadataRepository.saved.values()).singleElement()
                .extracting(ObjectMetadata::getQuarantineState)
                .isEqualTo(ObjectQuarantineState.REJECTED);
    }

    @Test
    void activateRejectsRequestForUnknownProductWithAccessDenied() {
        // Doesn't seed any product. Pre-fix this would have looked up the
        // metadata directly; post-fix the ownership gate fires first.
        assertThatThrownBy(() -> service.activate(
                "00000000-0000-0000-0000-000000000001",
                "seller-1",
                "products/00000000-0000-0000-0000-000000000001/images/x.png",
                ProductImageActivationRequest.builder()
                        .detectedContentType("image/png")
                        .contentLength(1024)
                        .sha256Hex("a".repeat(64))
                        .imageWidth(800)
                        .imageHeight(600)
                        .build()))
                .isInstanceOf(ProductAccessDeniedException.class);
        // Crucially: the metadata table is never queried — the gate runs
        // before the repository lookup, so existence isn't leaked.
        assertThat(metadataRepository.findByKeyCalls).isEmpty();
    }

    @Test
    void activateRejectsRequestFromWrongSellerWithAccessDenied() {
        UUID productId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        productRepository.save(product(productId, "seller-1"));

        assertThatThrownBy(() -> service.activate(
                productId.toString(),
                "seller-2",  // not the owner
                "products/" + productId + "/images/x.png",
                ProductImageActivationRequest.builder()
                        .detectedContentType("image/png")
                        .contentLength(1024)
                        .sha256Hex("a".repeat(64))
                        .imageWidth(800)
                        .imageHeight(600)
                        .build()))
                .isInstanceOf(ProductAccessDeniedException.class);
        assertThat(metadataRepository.findByKeyCalls).isEmpty();
    }

    @Test
    void activateRejectsObjectKeyForDifferentProductWithAccessDenied() {
        // The owner is correct, but the objectKey targets a different product.
        // Critical: pt20 stacked the IDOR with the avScanClean bypass — without
        // the path-prefix check, a hostile seller who legitimately owns product A
        // could activate an objectKey on product B by passing their own JWT.
        UUID productId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        productRepository.save(product(productId, "seller-1"));

        assertThatThrownBy(() -> service.activate(
                productId.toString(),
                "seller-1",
                "products/00000000-0000-0000-0000-000000000099/images/x.png",
                ProductImageActivationRequest.builder()
                        .detectedContentType("image/png")
                        .contentLength(1024)
                        .sha256Hex("a".repeat(64))
                        .imageWidth(800)
                        .imageHeight(600)
                        .build()))
                .isInstanceOf(ProductAccessDeniedException.class);
        assertThat(metadataRepository.findByKeyCalls).isEmpty();
    }

    private ProductImageUploadRequest.ProductImageUploadRequestBuilder validRequest() {
        return ProductImageUploadRequest.builder()
                .productId("00000000-0000-0000-0000-000000000001")
                .sellerId("seller-1")
                .fileName("front.png")
                .declaredContentType("image/png")
                .detectedContentType("image/png")
                .contentLength(1024)
                .sha256Hex("a".repeat(64))
                .imageWidth(800)
                .imageHeight(600);
    }

    private Product product(UUID productId, String sellerId) {
        return new Product(productId, sellerId, "Phone", "Fast phone", "phones", "VNShop", null, null);
    }

    private static final class FakeProductRepository implements ProductRepositoryPort {
        private final Map<UUID, Product> products = new HashMap<>();

        @Override
        public Product save(Product product) {
            products.put(product.productId(), product);
            return product;
        }

        @Override
        public Optional<Product> findById(UUID productId) {
            return Optional.ofNullable(products.get(productId));
        }

        @Override
        public java.util.List<Product> findBySellerId(String sellerId) {
            return java.util.List.of();
        }

        @Override
        public java.util.List<Product> findByCategory(String categoryId) {
            return java.util.List.of();
        }

        @Override
        public java.util.List<Product> searchByName(String name) {
            return java.util.List.of();
        }

        @Override
        public java.util.List<String> findDistinctCategories() {
            return java.util.List.of();
        }

        @Override
        public org.springframework.data.domain.Page<Product> findCatalog(
                String categoryId, String q, String sellerId, org.springframework.data.domain.Pageable pageable) {
            return org.springframework.data.domain.Page.empty(pageable);
        }

        @Override
        public long countBySellerId(String sellerId) {
            return products.values().stream().filter(p -> sellerId.equals(p.sellerId())).count();
        }

        @Override
        public java.util.Map<String, Long> countBySellerIds(java.util.Set<String> sellerIds) {
            java.util.Map<String, Long> result = new java.util.HashMap<>();
            for (String id : sellerIds) {
                result.put(id, products.values().stream().filter(p -> id.equals(p.sellerId())).count());
            }
            return result;
        }
    }

    private static final class FakeObjectStorage implements ObjectStoragePort {
        private String lastKey;
        private ObjectMetadata lastMetadata;

        @Override
        public void putObject(String key, InputStream content, ObjectMetadata metadata) {
        }

        @Override
        public URI getSignedUploadUrl(String key, ObjectMetadata metadata) {
            lastKey = key;
            lastMetadata = metadata;
            return URI.create("https://storage.test/" + key);
        }

        @Override
        public URI getSignedDownloadUrl(String key, ObjectStorageClass storageClass) {
            return URI.create("https://storage.test/" + key);
        }

        @Override
        public void deleteObject(String key) {
        }

        @Override
        public Optional<ObjectMetadata> headObject(String key) {
            return Optional.empty();
        }

        @Override
        public URI publicUrl(String key) {
            return URI.create("https://cdn.test/" + key);
        }

        @Override
        public void copyObject(String sourceKey, String destinationKey) {
        }
    }
}
