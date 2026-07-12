package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.domain.Category;

import java.util.List;

/**
 * DTO for category tree responses.
 * Each node contains id, parentId, name, label, and recursive children.
 */
public record CategoryResponse(
        String id,
        String parentId,
        String name,
        String label,
        List<CategoryResponse> children
) {
    public static CategoryResponse fromDomain(Category category) {
        return new CategoryResponse(
                category.id(),
                category.parentId(),
                category.name(),
                category.label(),
                category.children().stream()
                        .map(CategoryResponse::fromDomain)
                        .toList()
        );
    }
}
