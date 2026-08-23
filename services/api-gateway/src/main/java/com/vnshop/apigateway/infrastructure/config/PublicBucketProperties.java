package com.vnshop.apigateway.infrastructure.config;

import java.util.List;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vnshop.gateway.public-buckets")
public record PublicBucketProperties(
        String avatar,
        String product,
        String review,
        String video) {

    private static final Pattern BUCKET_NAME = Pattern.compile(
            "^[a-z0-9](?!.*\\.\\.)(?!.*\\.-)(?!.*-\\.)[a-z0-9.-]{1,61}[a-z0-9]$");

    public PublicBucketProperties {
        avatar = validate("avatar", avatar);
        product = validate("product", product);
        review = validate("review", review);
        video = validate("video", video);
    }

    public static PublicBucketProperties defaults() {
        return new PublicBucketProperties(
                "vnshop-avatars", "vnshop-products", "vnshop-reviews", "vnshop-videos");
    }

    public String[] routePatterns() {
        return buckets().stream().map(bucket -> "/" + bucket + "/**").toArray(String[]::new);
    }

    public List<String> objectPrefixes() {
        return buckets().stream().map(bucket -> "/" + bucket + "/").toList();
    }

    private List<String> buckets() {
        return List.of(avatar, product, review, video);
    }

    private static String validate(String field, String value) {
        if (value == null || !BUCKET_NAME.matcher(value).matches()) {
            throw new IllegalArgumentException(
                    "vnshop.gateway.public-buckets." + field
                            + " must be a DNS-compatible S3 bucket name");
        }
        return value;
    }
}
