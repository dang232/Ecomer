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
import com.vnshop.productservice.application.UpdateProductEligibilityUseCase;
import com.vnshop.productservice.application.PublishProductUseCase;
import com.vnshop.productservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

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

    public ProductController(CreateProductUseCase createProductUseCase, UpdateProductUseCase updateProductUseCase,
            UpdateProductEligibilityUseCase updateProductEligibilityUseCase,
            PublishProductUseCase publishProductUseCase,
            DeleteProductUseCase deleteProductUseCase, GetProductUseCase getProductUseCase,
            CountSellerProductsUseCase countSellerProductsUseCase, GetCategoriesUseCase getCategoriesUseCase) {
        this.createProductUseCase = createProductUseCase;
        this.updateProductUseCase = updateProductUseCase;
        this.updateProductEligibilityUseCase = updateProductEligibilityUseCase;
        this.publishProductUseCase = publishProductUseCase;
        this.deleteProductUseCase = deleteProductUseCase;
        this.getProductUseCase = getProductUseCase;
        this.countSellerProductsUseCase = countSellerProductsUseCase;
        this.getCategoriesUseCase = getCategoriesUseCase;
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
                request.toImages()
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
                request.toImages()
        ));
    }

    @DeleteMapping("/sellers/me/products/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('SELLER') or hasRole('ADMIN')")
    public void delete(@PathVariable UUID id) {
        deleteProductUseCase.delete(id, JwtPrincipalUtil.currentSellerId());
    }

    @GetMapping("/products")
    public ApiResponse<Page<ProductResponse>> findProducts(
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String sellerId,
            Pageable pageable
    ) {
        return ApiResponse.ok(getProductUseCase.findCatalog(categoryId, q, sellerId, pageable));
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
}
