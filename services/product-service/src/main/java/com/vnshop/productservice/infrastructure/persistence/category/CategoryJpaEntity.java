package com.vnshop.productservice.infrastructure.persistence.category;

import com.vnshop.productservice.domain.Category;
import com.vnshop.productservice.infrastructure.persistence.BaseJpaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(schema = "product_svc", name = "categories")
@Getter
@Setter
public class CategoryJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "id", length = 255)
    private String id;

    @Column(name = "parent_id")
    private String parentId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active;

    protected CategoryJpaEntity() {
    }

    static CategoryJpaEntity fromDomain(Category category) {
        CategoryJpaEntity entity = new CategoryJpaEntity();
        entity.id = category.id();
        entity.parentId = category.parentId();
        entity.name = category.name();
        entity.label = category.label();
        entity.sortOrder = category.sortOrder();
        entity.active = category.active();
        return entity;
    }

    Category toDomain() {
        return new Category(id, parentId, name, label, sortOrder, active);
    }
}
