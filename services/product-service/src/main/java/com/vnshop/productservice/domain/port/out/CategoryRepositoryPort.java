package com.vnshop.productservice.domain.port.out;

import com.vnshop.productservice.domain.Category;

import java.util.List;

public interface CategoryRepositoryPort {
    List<Category> findAll();
}
