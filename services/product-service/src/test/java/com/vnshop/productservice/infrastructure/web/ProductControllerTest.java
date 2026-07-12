package com.vnshop.productservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.infrastructure.web.CategoryResponse;
import com.vnshop.productservice.application.CountSellerProductsUseCase;
import com.vnshop.productservice.application.CreateProductUseCase;
import com.vnshop.productservice.application.DeleteProductUseCase;
import com.vnshop.productservice.application.GetCategoriesUseCase;
import com.vnshop.productservice.application.GetProductUseCase;
import com.vnshop.productservice.application.UpdateProductUseCase;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Unit tests for ProductController - focusing on category endpoint.
 */
@ExtendWith(MockitoExtension.class)
class ProductControllerTest {

    @Mock
    private CreateProductUseCase createProductUseCase;
    @Mock
    private UpdateProductUseCase updateProductUseCase;
    @Mock
    private DeleteProductUseCase deleteProductUseCase;
    @Mock
    private GetProductUseCase getProductUseCase;
    @Mock
    private CountSellerProductsUseCase countSellerProductsUseCase;
    @Mock
    private GetCategoriesUseCase getCategoriesUseCase;

    @InjectMocks
    private ProductController controller;

    @Test
    void findCategories_returnsTreeWithRootOrdering() {
        // Given: two root categories with different sort orders
        CategoryResponse electronics = new CategoryResponse(
                "electronics",
                null,
                "electronics",
                "Điện tử",
                List.of()
        );
        CategoryResponse clothing = new CategoryResponse(
                "clothing",
                null,
                "clothing",
                "Quần áo",
                List.of()
        );

        // Expect sorted by sort order (electronics=10 comes before clothing=20)
        when(getCategoriesUseCase.getCategoryTree())
                .thenReturn(Arrays.asList(electronics, clothing));

        // When
        ApiResponse<List<CategoryResponse>> response = controller.findCategories();

        // Then
        assertThat(response.success()).isTrue();
        assertThat(response.data()).hasSize(2);
        assertThat(response.data().get(0).id()).isEqualTo("electronics");
        assertThat(response.data().get(1).id()).isEqualTo("clothing");
    }

    @Test
    void findCategories_returnsNestedChildrenWithOrdering() {
        // Given: electronics with nested children
        CategoryResponse phones = new CategoryResponse(
                "phones",
                "electronics",
                "phones",
                "Điện thoại",
                List.of()
        );
        CategoryResponse laptops = new CategoryResponse(
                "laptops",
                "electronics",
                "laptops",
                "Laptop",
                List.of()
        );
        CategoryResponse electronics = new CategoryResponse(
                "electronics",
                null,
                "electronics",
                "Điện tử",
                Arrays.asList(phones, laptops) // sorted order
        );

        when(getCategoriesUseCase.getCategoryTree())
                .thenReturn(List.of(electronics));

        // When
        ApiResponse<List<CategoryResponse>> response = controller.findCategories();

        // Then
        assertThat(response.success()).isTrue();
        assertThat(response.data()).hasSize(1);
        assertThat(response.data().get(0).children()).hasSize(2);
        // Children should be sorted by sort order (phones=10 before laptops=20)
        assertThat(response.data().get(0).children().get(0).id()).isEqualTo("phones");
        assertThat(response.data().get(0).children().get(1).id()).isEqualTo("laptops");
    }

    @Test
    void findCategories_includesLabels() {
        // Given: categories with Vietnamese labels
        CategoryResponse category = new CategoryResponse(
                "electronics",
                null,
                "electronics",
                "Điện tử",
                List.of()
        );

        when(getCategoriesUseCase.getCategoryTree())
                .thenReturn(List.of(category));

        // When
        ApiResponse<List<CategoryResponse>> response = controller.findCategories();

        // Then
        assertThat(response.success()).isTrue();
        assertThat(response.data().get(0).label()).isEqualTo("Điện tử");
        assertThat(response.data().get(0).name()).isEqualTo("electronics");
    }

    @Test
    void findCategories_noDuplicateIds() {
        // Given: categories with no duplicates
        CategoryResponse root = new CategoryResponse(
                "root",
                null,
                "root",
                "Root Category",
                List.of(
                        new CategoryResponse("child1", "root", "child1", "Child 1", List.of()),
                        new CategoryResponse("child2", "root", "child2", "Child 2", List.of())
                )
        );

        when(getCategoriesUseCase.getCategoryTree())
                .thenReturn(List.of(root));

        // When
        ApiResponse<List<CategoryResponse>> response = controller.findCategories();

        // Then
        assertThat(response.success()).isTrue();
        List<String> allIds = flattenIds(response.data());
        assertThat(allIds).containsExactlyInAnyOrder("root", "child1", "child2");
    }

    @Test
    void findCategories_emptyChildrenSerializedAsEmptyList() {
        // Given: category with no children
        CategoryResponse category = new CategoryResponse(
                "empty",
                null,
                "empty",
                "Empty Category",
                Collections.emptyList()
        );

        when(getCategoriesUseCase.getCategoryTree())
                .thenReturn(List.of(category));

        // When
        ApiResponse<List<CategoryResponse>> response = controller.findCategories();

        // Then
        assertThat(response.success()).isTrue();
        assertThat(response.data().get(0).children()).isEmpty();
    }

    private List<String> flattenIds(List<CategoryResponse> categories) {
        return categories.stream()
                .flatMap(c -> {
                    List<String> ids = new java.util.ArrayList<>();
                    ids.add(c.id());
                    if (c.children() != null) {
                        ids.addAll(flattenIds(c.children()));
                    }
                    return ids.stream();
                })
                .toList();
    }
}
