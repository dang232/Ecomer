package com.vnshop.productservice.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
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
        this(productId, sellerId, name, description, categoryId, brand, ProductStatus.DRAFT,
                variants, images, sameDayDelivery, verified, isOfficial);
    }

    @JsonCreator
    public Product(
            @JsonProperty("productId") UUID productId,
            @JsonProperty("sellerId") String sellerId,
            @JsonProperty("name") String name,
            @JsonProperty("description") String description,
            @JsonProperty("categoryId") String categoryId,
            @JsonProperty("brand") String brand,
            @JsonProperty("status") ProductStatus status,
            @JsonProperty("variants") List<ProductVariant> variants,
            @JsonProperty("images") List<ProductImage> images,
            @JsonProperty("sameDayDelivery") boolean sameDayDelivery,
            @JsonProperty("verified") boolean verified,
            @JsonProperty("isOfficial") boolean isOfficial
    ) {
        this.productId = productId == null ? UUID.randomUUID() : productId;
        this.sellerId = sellerId;
        this.name = requireValidName(name);
        this.description = requireValidDescription(description);
        this.categoryId = categoryId;
        this.brand = brand;
        this.status = status == null ? ProductStatus.DRAFT : status;
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

    @JsonProperty("productId")
    public UUID productId() {
        return productId;
    }

    @JsonProperty("sellerId")
    public String sellerId() {
        return sellerId;
    }

    @JsonProperty("name")
    public String name() {
        return name;
    }

    @JsonProperty("description")
    public String description() {
        return description;
    }

    @JsonProperty("categoryId")
    public String categoryId() {
        return categoryId;
    }

    @JsonProperty("brand")
    public String brand() {
        return brand;
    }

    @JsonProperty("status")
    public ProductStatus status() {
        return status;
    }

    @JsonProperty("variants")
    public List<ProductVariant> variants() {
        return List.copyOf(variants);
    }

    @JsonProperty("images")
    public List<ProductImage> images() {
        return List.copyOf(images);
    }

    @JsonProperty("sameDayDelivery")
    public boolean sameDayDelivery() {
        return sameDayDelivery;
    }

    @JsonProperty("verified")
    public boolean verified() {
        return verified;
    }

    @JsonProperty("isOfficial")
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
