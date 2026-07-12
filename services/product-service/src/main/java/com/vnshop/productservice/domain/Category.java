package com.vnshop.productservice.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Category represents a node in the product category taxonomy tree.
 * Each category has a stable string ID, optional parent for hierarchy,
 * canonical name, buyer-facing label, sort order, and active flag.
 */
public class Category {
    private final String id;
    private final String parentId;
    private final String name;
    private final String label;
    private final int sortOrder;
    private final boolean active;
    private final List<Category> children;

    public Category(String id, String parentId, String name, String label, int sortOrder, boolean active) {
        this.id = Objects.requireNonNull(id, "id is required");
        this.parentId = parentId;
        this.name = Objects.requireNonNull(name, "name is required");
        this.label = Objects.requireNonNull(label, "label is required");
        this.sortOrder = sortOrder;
        this.active = active;
        this.children = new ArrayList<>();
    }

    public String id() {
        return id;
    }

    public String parentId() {
        return parentId;
    }

    public String name() {
        return name;
    }

    public String label() {
        return label;
    }

    public int sortOrder() {
        return sortOrder;
    }

    public boolean active() {
        return active;
    }

    public List<Category> children() {
        return List.copyOf(children);
    }

    public Category withChildren(List<Category> children) {
        Category category = new Category(id, parentId, name, label, sortOrder, active);
        category.children.addAll(children);
        return category;
    }

    public boolean isRoot() {
        return parentId == null;
    }
}
