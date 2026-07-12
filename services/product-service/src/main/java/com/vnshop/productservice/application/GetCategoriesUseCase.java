package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Category;
import com.vnshop.productservice.domain.port.out.CategoryRepositoryPort;

import java.util.List;

public class GetCategoriesUseCase {
    private final CategoryRepositoryPort categoryRepositoryPort;

    public GetCategoriesUseCase(CategoryRepositoryPort categoryRepositoryPort) {
        this.categoryRepositoryPort = categoryRepositoryPort;
    }

    public List<Category> getCategoryTree() {
        return categoryRepositoryPort.findAll();
    }
}
