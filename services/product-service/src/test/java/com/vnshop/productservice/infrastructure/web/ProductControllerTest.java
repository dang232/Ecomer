package com.vnshop.productservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.application.CountSellerProductsUseCase;
import com.vnshop.productservice.application.CreateProductUseCase;
import com.vnshop.productservice.application.DeleteProductUseCase;
import com.vnshop.productservice.application.GetCategoriesUseCase;
import com.vnshop.productservice.application.GetProductUseCase;
import com.vnshop.productservice.application.UpdateProductUseCase;
import com.vnshop.productservice.application.UpdateProductEligibilityUseCase;
import com.vnshop.productservice.domain.Category;
import java.util.List;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProductControllerTest {

    @Mock private CreateProductUseCase createProductUseCase;
    @Mock private UpdateProductUseCase updateProductUseCase;
    @Mock private UpdateProductEligibilityUseCase updateProductEligibilityUseCase;
    @Mock private DeleteProductUseCase deleteProductUseCase;
    @Mock private GetProductUseCase getProductUseCase;
    @Mock private CountSellerProductsUseCase countSellerProductsUseCase;
    @Mock private GetCategoriesUseCase getCategoriesUseCase;

    @InjectMocks private ProductController controller;

    @Test
    void findCategories_mapsDomainCategoriesToTreeResponse() {
        Category phones = category("phones", "electronics", "phones", "Phones");
        Category electronics = category("electronics", null, "electronics", "Electronics", phones);
        Category clothing = category("clothing", null, "clothing", "Clothing");
        when(getCategoriesUseCase.getCategoryTree()).thenReturn(List.of(electronics, clothing));

        ApiResponse<List<CategoryResponse>> response = controller.findCategories();

        assertThat(response.success()).isTrue();
        assertThat(response.data()).extracting(CategoryResponse::id)
                .containsExactly("electronics", "clothing");
        assertThat(response.data().getFirst().label()).isEqualTo("Electronics");
        assertThat(response.data().getFirst().children()).extracting(CategoryResponse::id)
                .containsExactly("phones");
    }

    @Test
    void findCategories_serializesEmptyChildrenAsAnEmptyList() {
        when(getCategoriesUseCase.getCategoryTree())
                .thenReturn(List.of(category("empty", null, "empty", "Empty")));

        ApiResponse<List<CategoryResponse>> response = controller.findCategories();

        assertThat(response.data().getFirst().children()).isEmpty();
    }

    @Test
    void exposesAdminEligibilityUpdateEndpoint() {
        boolean endpointExists = Arrays.stream(ProductController.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(org.springframework.web.bind.annotation.PutMapping.class))
                .flatMap(method -> Arrays.stream(
                        method.getAnnotation(org.springframework.web.bind.annotation.PutMapping.class).value()))
                .anyMatch("/products/{id}/eligibility"::equals);

        assertThat(endpointExists).isTrue();
    }

    private static Category category(String id, String parentId, String name, String label, Category... children) {
        return new Category(id, parentId, name, label, 10, true).withChildren(List.of(children));
    }
}
