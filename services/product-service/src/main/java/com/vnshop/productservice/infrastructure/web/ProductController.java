package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.infrastructure.web.CategoryResponse;
import com.vnshop.productservice.application.CountSellerProductsUseCase;
import com.vnshop.productservice.application.CreateProductCommand;
import com.vnshop.productservice.application.CreateProductUseCase;
import com.vnshop.productservice.application.DeleteProductUseCase;
import com.vnshop.productservice.application.GetCategoriesUseCase;
import com.vnshop.productservice.application.GetProductUseCase;
import com.vnshop.productservice.application.ProductResponse;
import com.vnshop.productservice.application.UpdateProductUseCase;
import com.vnshop.productservice.domain.ProductTagNormalizer;
import com.vnshop.productservice.application.UpdateProductEligibilityUseCase;
import com.vnshop.productservice.application.PublishProductUseCase;
import com.vnshop.productservice.application.CatalogCursorSort;
import com.vnshop.productservice.application.CatalogV2Query;
import com.vnshop.productservice.application.CatalogV2Response;
import com.vnshop.productservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping
public class ProductController {
    private final CreateProductUseCase createProductUseCase;
    private final UpdateProductUseCase updateProductUseCase;
    private final UpdateProductEligibilityUseCase updateProductEligibilityUseCase;
    private final PublishProductUseCase publishProductUseCase;
    private final DeleteProductUseCase deleteProductUseCase;
    private final GetProductUseCase getProductUseCase;
    private final CountSellerProductsUseCase countSellerProductsUseCase;
    private final GetCategoriesUseCase getCategoriesUseCase;
    private final ProductTagNormalizer productTagNormalizer;

    public ProductController(CreateProductUseCase createProductUseCase, UpdateProductUseCase updateProductUseCase,
            UpdateProductEligibilityUseCase updateProductEligibilityUseCase,
            PublishProductUseCase publishProductUseCase,
            DeleteProductUseCase deleteProductUseCase, GetProductUseCase getProductUseCase,
            CountSellerProductsUseCase countSellerProductsUseCase, GetCategoriesUseCase getCategoriesUseCase,
            ProductTagNormalizer productTagNormalizer) {
        this.createProductUseCase = createProductUseCase;
        this.updateProductUseCase = updateProductUseCase;
        this.updateProductEligibilityUseCase = updateProductEligibilityUseCase;
        this.publishProductUseCase = publishProductUseCase;
        this.deleteProductUseCase = deleteProductUseCase;
        this.getProductUseCase = getProductUseCase;
        this.countSellerProductsUseCase = countSellerProductsUseCase;
        this.getCategoriesUseCase = getCategoriesUseCase;
        this.productTagNormalizer = productTagNormalizer;
    }

    @PostMapping("/sellers/me/products")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('SELLER') or hasRole('ADMIN')")
    public ApiResponse<ProductResponse> create(@RequestBody ProductRequest request) {
        CreateProductCommand command = new CreateProductCommand(
                JwtPrincipalUtil.currentSellerId(),
                request.name(),
                request.description(),
                request.categoryId(),
                request.brand(),
                request.toVariants(),
                request.toImages(),
                request.toTags(productTagNormalizer)
        );
        return ApiResponse.ok(createProductUseCase.create(command));
    }

    @PutMapping("/sellers/me/products/{id}")
    @PreAuthorize("hasRole('SELLER') or hasRole('ADMIN')")
    public ApiResponse<ProductResponse> update(@PathVariable UUID id, @RequestBody ProductRequest request) {
        return ApiResponse.ok(updateProductUseCase.update(
                JwtPrincipalUtil.currentSellerId(),
                id,
                request.name(),
                request.description(),
                request.categoryId(),
                request.brand(),
                request.toVariants(),
                request.toImages(),
                request.toTags(productTagNormalizer)
        ));
    }

    @DeleteMapping("/sellers/me/products/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('SELLER') or hasRole('ADMIN')")
    public void delete(@PathVariable UUID id) {
        deleteProductUseCase.delete(id, JwtPrincipalUtil.currentSellerId());
    }

    /**
     * @deprecated Use cursor-based {@code /products/v2} for buyer catalog reads.
     */
    @Deprecated(since = "2026.07", forRemoval = false)
    @GetMapping("/products")
    public ApiResponse<Page<ProductResponse>> findProducts(
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String sellerId,
            Pageable pageable
    ) {
        return ApiResponse.ok(getProductUseCase.findCatalog(categoryId, q, sellerId, pageable));
    }

    @GetMapping("/products/v2")
    public ResponseEntity<ApiResponse<CatalogV2Response>> findProductsV2(
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) java.math.BigDecimal minPrice,
            @RequestParam(required = false) java.math.BigDecimal maxPrice,
            @RequestParam(required = false) String sort,
            @RequestParam(name = "sameDay", required = false) Boolean sameDay,
            @RequestParam(name = "verifiedOnly", required = false) Boolean verifiedOnly,
            @RequestParam(name = "officialOnly", required = false) Boolean officialOnly,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "24") int limit,
            @RequestParam(defaultValue = "false") boolean includeFacets,
            @RequestHeader(name = "X-Correlation-Id", required = false) String correlationId,
            @RequestHeader(name = "X-Request-Id", required = false) String requestId,
            @RequestHeader(name = "If-None-Match", required = false) String ifNoneMatch,
            HttpServletResponse response) {
        String effectiveRequestId = effectiveRequestId(correlationId, requestId);
        response.setHeader("X-Correlation-Id", effectiveRequestId);
        response.setHeader("X-Request-Id", effectiveRequestId);
        CatalogV2Response result = getProductUseCase.findCatalogV2(new CatalogV2Query(
                query, category, brand, minPrice, maxPrice, CatalogCursorSort.parse(sort),
                sameDay, verifiedOnly, officialOnly, cursor, limit, includeFacets));
        String etag = StableEtag.of(result);
        if ("*".equals(ifNoneMatch) || etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        return ResponseEntity.ok().eTag(etag).body(ApiResponse.okWithMeta(result, new ApiMeta(
                effectiveRequestId, "miss", false, result.nextCursor(), result.hasMore())));
    }

    // NOTE: /products/count is a literal segment and must be declared before /products/{id}
    // so Spring resolves it first. Spring MVC already prefers literal over path-variable
    // segments, but explicit ordering here makes the intent clear.
    @GetMapping("/products/count")
    public ApiResponse<SellerProductCountResponse> countBySeller(@RequestParam String sellerId) {
        return ApiResponse.ok(new SellerProductCountResponse(countSellerProductsUseCase.count(sellerId)));
    }

    @PostMapping("/products/counts")
    public ApiResponse<ProductCountsResponse> countBySellerIds(@Valid @RequestBody ProductCountsRequest request) {
        return ApiResponse.ok(new ProductCountsResponse(countSellerProductsUseCase.countAll(request.sellerIds())));
    }

    @GetMapping("/products/{id}")
    public ApiResponse<ProductResponse> findProduct(@PathVariable UUID id) {
        return ApiResponse.ok(getProductUseCase.findPublicById(id));
    }

    @PutMapping("/sellers/me/products/{id}/publish")
    @PreAuthorize("hasRole('SELLER') or hasRole('ADMIN')")
    public ApiResponse<ProductResponse> publish(@PathVariable UUID id) {
        return ApiResponse.ok(publishProductUseCase.publish(JwtPrincipalUtil.currentSellerId(), id));
    }

    @GetMapping("/categories")
    public ApiResponse<List<CategoryResponse>> findCategories() {
        return ApiResponse.ok(getCategoriesUseCase.getCategoryTree().stream()
                .map(CategoryResponse::fromDomain)
                .toList());
    }

    @PutMapping("/products/{id}/eligibility")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ProductResponse> updateEligibility(
            @PathVariable UUID id,
            @RequestBody ProductEligibilityRequest request) {
        return ApiResponse.ok(updateProductEligibilityUseCase.update(
                id,
                request.sameDayDelivery(),
                request.verified(),
                request.isOfficial()));
    }

    private static String effectiveRequestId(String correlationId, String requestId) {
        String candidate = validRequestId(correlationId) ? correlationId : requestId;
        return validRequestId(candidate) ? candidate : UUID.randomUUID().toString();
    }

    private static boolean validRequestId(String value) {
        return value != null && value.length() <= 128 && value.matches("[A-Za-z0-9._:-]+");
    }
}
