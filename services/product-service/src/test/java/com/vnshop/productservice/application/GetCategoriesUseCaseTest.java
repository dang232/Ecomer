package com.vnshop.productservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.Category;
import com.vnshop.productservice.domain.port.out.CategoryRepositoryPort;
import java.util.List;
import org.junit.jupiter.api.Test;

class GetCategoriesUseCaseTest {

    @Test
    void getCategoryTree_returnsDomainCategoriesWithoutWebMapping() {
        CategoryRepositoryPort repository = mock(CategoryRepositoryPort.class);
        Category root = new Category("electronics", null, "electronics", "Electronics", 10, true);
        when(repository.findAll()).thenReturn(List.of(root));

        GetCategoriesUseCase useCase = new GetCategoriesUseCase(repository);

        List<Category> categories = useCase.getCategoryTree();

        assertThat(categories).containsExactly(root);
    }
}
