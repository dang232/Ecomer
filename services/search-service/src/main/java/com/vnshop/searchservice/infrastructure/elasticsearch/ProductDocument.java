package com.vnshop.searchservice.infrastructure.elasticsearch;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;
import org.springframework.data.elasticsearch.annotations.InnerField;
import org.springframework.data.elasticsearch.annotations.MultiField;
import org.springframework.data.elasticsearch.annotations.Setting;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Document(indexName = "products")
@Setting(settingPath = "/elasticsearch/product-settings.json")
public class ProductDocument {

    @Id
    private String id;

    @MultiField(
            mainField = @Field(type = FieldType.Text, analyzer = "vietnamese_analyzer"),
            otherFields = @InnerField(suffix = "keyword", type = FieldType.Keyword)
    )
    private String name;

    @Field(type = FieldType.Text, analyzer = "vietnamese_analyzer")
    private String description;

    @Field(type = FieldType.Keyword)
    private String categoryId;

    @Field(type = FieldType.Keyword)
    private String categoryName;

    @Field(type = FieldType.Keyword)
    private String brand;

    @Field(type = FieldType.Double)
    private BigDecimal price;

    @Field(type = FieldType.Double)
    private BigDecimal originalPrice;

    @Field(type = FieldType.Float)
    private Float averageRating;

    @Field(type = FieldType.Integer)
    private Integer reviewCount;

    @Field(type = FieldType.Keyword)
    private String sellerId;

    @Field(type = FieldType.Keyword)
    private String sellerName;

    @Field(type = FieldType.Keyword)
    private String status;

    @Field(type = FieldType.Keyword)
    private List<String> imageUrls;

    @Field(type = FieldType.Integer)
    private Integer stock;

    @Field(type = FieldType.Date)
    private Instant createdAt;

    @Field(type = FieldType.Integer)
    private Integer totalSold;

    @Field(type = FieldType.Boolean)
    private Boolean sameDayDelivery;

    @Field(type = FieldType.Boolean)
    private Boolean verified;

    @Field(type = FieldType.Boolean)
    private Boolean isOfficial;

    // -------------------------------------------------------------------------
    // Getters and setters (explicit — avoids Lombok annotation-processor issues
    // on newer JDK versions)
    // -------------------------------------------------------------------------

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategoryId() { return categoryId; }
    public void setCategoryId(String categoryId) { this.categoryId = categoryId; }

    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public BigDecimal getOriginalPrice() { return originalPrice; }
    public void setOriginalPrice(BigDecimal originalPrice) { this.originalPrice = originalPrice; }

    public Float getAverageRating() { return averageRating; }
    public void setAverageRating(Float averageRating) { this.averageRating = averageRating; }

    public Integer getReviewCount() { return reviewCount; }
    public void setReviewCount(Integer reviewCount) { this.reviewCount = reviewCount; }

    public String getSellerId() { return sellerId; }
    public void setSellerId(String sellerId) { this.sellerId = sellerId; }

    public String getSellerName() { return sellerName; }
    public void setSellerName(String sellerName) { this.sellerName = sellerName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getImageUrls() { return imageUrls; }
    public void setImageUrls(List<String> imageUrls) { this.imageUrls = imageUrls; }

    public Integer getStock() { return stock; }
    public void setStock(Integer stock) { this.stock = stock; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Integer getTotalSold() { return totalSold; }
    public void setTotalSold(Integer totalSold) { this.totalSold = totalSold; }

    public Boolean getSameDayDelivery() { return sameDayDelivery; }
    public void setSameDayDelivery(Boolean sameDayDelivery) { this.sameDayDelivery = sameDayDelivery; }

    public Boolean getVerified() { return verified; }
    public void setVerified(Boolean verified) { this.verified = verified; }

    public Boolean getIsOfficial() { return isOfficial; }
    public void setIsOfficial(Boolean isOfficial) { this.isOfficial = isOfficial; }

    /**
     * Builds a {@link ProductDocument} from a Kafka event payload. Unknown or
     * missing fields are mapped to {@code null} / sensible defaults so the
     * document is always well-formed even when the producer omits optional fields.
     */
    public static ProductDocument fromEvent(String productId, Map<String, Object> payload) {
        ProductDocument doc = new ProductDocument();
        doc.setId(productId);
        doc.setName(stringValue(payload.get("name")));
        doc.setDescription(stringValue(payload.get("description")));
        doc.setCategoryId(stringValue(payload.get("categoryId")));
        doc.setCategoryName(stringValue(payload.get("categoryName")));
        doc.setBrand(stringValue(payload.get("brand")));
        doc.setPrice(decimalValue(payload.get("minPrice")));
        doc.setOriginalPrice(decimalValue(payload.get("originalPrice")));
        doc.setAverageRating(floatValue(payload.get("averageRating")));
        doc.setReviewCount(intValue(payload.get("reviewCount")));
        doc.setSellerId(stringValue(payload.get("sellerId")));
        doc.setSellerName(stringValue(payload.get("sellerName")));
        doc.setStatus(stringValue(payload.getOrDefault("status", "DRAFT")));
        String imageUrl = stringValue(payload.get("imageUrl"));
        doc.setImageUrls(imageUrl == null ? List.of() : List.of(imageUrl));
        doc.setStock(intValue(payload.get("stock")));
        doc.setTotalSold(intValue(payload.get("totalSold")));
        doc.setSameDayDelivery(booleanValue(payload.get("sameDayDelivery")));
        doc.setVerified(booleanValue(payload.get("verified")));
        doc.setIsOfficial(booleanValue(payload.get("isOfficial")));
        doc.setCreatedAt(Instant.now());
        return doc;
    }

    // -------------------------------------------------------------------------
    // Private payload-extraction helpers (mirror the JpaEntity pattern)
    // -------------------------------------------------------------------------

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static BigDecimal decimalValue(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        return new BigDecimal(value.toString());
    }

    private static Float floatValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.floatValue();
        return Float.parseFloat(value.toString());
    }

    private static Integer intValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        return Integer.parseInt(value.toString());
    }

    private static Boolean booleanValue(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean b) return b;
        return Boolean.parseBoolean(value.toString());
    }
}
