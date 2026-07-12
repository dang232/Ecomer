package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Category;
import com.vnshop.productservice.domain.port.out.CategoryRepositoryPort;
import com.vnshop.productservice.infrastructure.web.CategoryResponse;

import java.util.List;

public class GetCategoriesUseCase {
    private final CategoryRepositoryPort categoryRepositoryPort;

    public GetCategoriesUseCase(CategoryRepositoryPort categoryRepositoryPort) {
        this.categoryRepositoryPort = categoryRepositoryPort;
    }

    public List<CategoryResponse> getCategoryTree() {
        List<Category> categories = categoryRepositoryPort.findAll();
        return categories.stream()
                .map(CategoryResponse::fromDomain)
                .toList();
    }
}
