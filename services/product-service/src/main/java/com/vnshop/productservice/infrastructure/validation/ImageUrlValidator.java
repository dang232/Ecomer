package com.vnshop.productservice.infrastructure.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;

/**
 * Validates that an image URL belongs to the application's own object storage.
 * Prevents open-redirect and content-spoofing via arbitrary external URLs
 * passed in product/variant creation requests.
 */
public class ImageUrlValidator implements ConstraintValidator<ValidImageUrl, String> {

    private final List<String> allowedOrigins;

    public ImageUrlValidator(
            @Value("${vnshop.image-security.allowed-origins:}") List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            // Blank validation is handled by @NotBlank if required
            return true;
        }

        // Must be a well-formed absolute URL with http(s)
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException e) {
            return false;
        }

        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equals("http") && !scheme.equals("https"))) {
            return false;
        }

        // Must start with one of the allowed storage origins.
        // The character immediately after the origin prefix must be '/' or absent,
        // preventing subdomain spoofing (e.g. "images.vnshop.com.evil.com").
        return allowedOrigins.stream().anyMatch(origin -> {
            if (!value.startsWith(origin)) {
                return false;
            }
            if (value.length() == origin.length()) {
                return true;
            }
            char next = value.charAt(origin.length());
            return next == '/' || next == '?' || next == '#';
        });
    }
}
