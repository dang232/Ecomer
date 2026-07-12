package com.vnshop.productservice.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class Product {
    private static final int MAX_NAME_LENGTH = 200;
    private static final int MAX_DESCRIPTION_LENGTH = 2000;
    private static final int MAX_VARIANTS = 50;
    private static final int MAX_IMAGES = 10;

    private final UUID productId;
    private final String sellerId;
    private String name;
    private String description;
    private String categoryId;
    private String brand;
    private ProductStatus status;
    private final List<ProductVariant> variants;
    private final List<ProductImage> images;
    private boolean sameDayDelivery;
    private boolean verified;
    private boolean isOfficial;

    public Product(
            UUID productId,
            String sellerId,
            String name,
            String description,
            String categoryId,
            String brand,
            List<ProductVariant> variants,
            List<ProductImage> images
    ) {
        this(productId, sellerId, name, description, categoryId, brand, variants, images, false, false, false);
    }

    public Product(
            UUID productId,
            String sellerId,
            String name,
            String description,
            String categoryId,
            String brand,
            List<ProductVariant> variants,
            List<ProductImage> images,
            boolean sameDayDelivery,
            boolean verified,
            boolean isOfficial
    ) {
        this.productId = productId == null ? UUID.randomUUID() : productId;
        this.sellerId = sellerId;
        this.name = requireValidName(name);
        this.description = requireValidDescription(description);
        this.categoryId = categoryId;
        this.brand = brand;
        this.status = ProductStatus.DRAFT;
        this.variants = new ArrayList<>();
        this.images = new ArrayList<>();
        this.sameDayDelivery = sameDayDelivery;
        this.verified = verified;
        this.isOfficial = isOfficial;
        if (variants != null) {
            if (variants.size() > MAX_VARIANTS) {
                throw new IllegalArgumentException("product cannot have more than 50 variants");
            }
            variants.forEach(this::addVariant);
        }
        if (images != null) {
            if (images.size() > MAX_IMAGES) {
                throw new IllegalArgumentException("product cannot have more than 10 images");
            }
            images.forEach(this::addImage);
        }
    }

    public UUID productId() {
        return productId;
    }

    public String sellerId() {
        return sellerId;
    }

    public String name() {
        return name;
    }

    public String description() {
        return description;
    }

    public String categoryId() {
        return categoryId;
    }

    public String brand() {
        return brand;
    }

    public ProductStatus status() {
        return status;
    }

    public List<ProductVariant> variants() {
        return List.copyOf(variants);
    }

    public List<ProductImage> images() {
        return List.copyOf(images);
    }

    public boolean sameDayDelivery() {
        return sameDayDelivery;
    }

    public boolean verified() {
        return verified;
    }

    public boolean isOfficial() {
        return isOfficial;
    }

    public void setSameDayDelivery(boolean sameDayDelivery) {
        this.sameDayDelivery = sameDayDelivery;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public void setOfficial(boolean official) {
        isOfficial = official;
    }

    public void publish() {
        if (status != ProductStatus.DRAFT) {
            throw new IllegalStateException("only draft products can be published");
        }
        status = ProductStatus.ACTIVE;
    }

    public void deactivate() {
        if (status == ProductStatus.ACTIVE) {
            status = ProductStatus.INACTIVE;
        }
    }

    public void softDelete() {
        if (this.status == ProductStatus.DELETED) {
            throw new IllegalStateException("Product already deleted");
        }
        this.status = ProductStatus.DELETED;
    }

    public void addVariant(ProductVariant variant) {
        Objects.requireNonNull(variant, "variant is required");
        if (variants.size() >= MAX_VARIANTS) {
            throw new IllegalArgumentException("product cannot have more than 50 variants");
        }
        boolean skuExists = variants.stream().anyMatch(existing -> existing.sku().equals(variant.sku()));
        if (skuExists) {
            throw new IllegalArgumentException("variant sku must be unique");
        }
        variants.add(variant);
    }

    public void addImage(ProductImage image) {
        Objects.requireNonNull(image, "image is required");
        if (images.size() >= MAX_IMAGES) {
            throw new IllegalArgumentException("product cannot have more than 10 images");
        }
        ProductImage imageToAdd = image.sortOrder() == 0 ? image.withSortOrder(images.size() + 1) : image;
        images.add(imageToAdd);
    }

    public void removeVariant(int index) {
        variants.remove(index);
    }

    public void removeImage(int index) {
        images.remove(index);
    }

    public void setOutOfStock() {
        status = ProductStatus.OUT_OF_STOCK;
    }

    public void setInStock() {
        status = ProductStatus.ACTIVE;
    }

    private static String requireValidName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (value.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("name cannot be longer than 200 characters");
        }
        return value;
    }

    private static String requireValidDescription(String value) {
        if (value != null && value.length() > MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("description cannot be longer than 2000 characters");
        }
        return value;
    }
}
