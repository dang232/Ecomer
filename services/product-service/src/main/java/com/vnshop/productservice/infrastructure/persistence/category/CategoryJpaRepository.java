package com.vnshop.productservice.infrastructure.persistence.category;

import com.vnshop.productservice.domain.Category;
import com.vnshop.productservice.domain.port.out.CategoryRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
public class CategoryJpaRepository implements CategoryRepositoryPort {
    private final CategoryJpaSpringDataRepository springDataRepository;

    public CategoryJpaRepository(CategoryJpaSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public List<Category> findAll() {
        List<CategoryJpaEntity> entities = springDataRepository.findAll();
        return buildCategoryTree(entities);
    }

    private List<Category> buildCategoryTree(List<CategoryJpaEntity> entities) {
        // Create map of all categories
        Map<String, CategoryJpaEntity> entityMap = entities.stream()
                .collect(Collectors.toMap(CategoryJpaEntity::getId, e -> e));

        // Find roots (categories with no parent or parent not in list)
        return entities.stream()
                .filter(e -> e.getParentId() == null || !entityMap.containsKey(e.getParentId()))
                .sorted((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()))
                .map(e -> buildTreeRecursive(e, entityMap))
                .collect(Collectors.toList());
    }

    private Category buildTreeRecursive(CategoryJpaEntity entity, Map<String, CategoryJpaEntity> entityMap) {
        List<Category> children = entityMap.values().stream()
                .filter(e -> entity.getId().equals(e.getParentId()))
                .sorted((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()))
                .map(child -> buildTreeRecursive(child, entityMap))
                .collect(Collectors.toList());

        return entity.toDomain().withChildren(children);
    }
}
