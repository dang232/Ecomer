package com.vnshop.productservice.infrastructure.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class ImageUrlValidatorTest {

    private final ImageUrlValidator validator = new ImageUrlValidator(
            List.of("http://localhost:9000", "https://images.vnshop.com"));

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  ", "\t"})
    void blankValues_areAccepted(String value) {
        // Blank enforcement is @NotBlank's job, not this validator
        assertThat(validator.isValid(value, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://localhost:9000/vnshop-products/123/images/abc.jpg",
            "http://localhost:9000/vnshop-avatars/user1/photo.png",
            "https://images.vnshop.com/products/456/images/def.webp"
    })
    void allowedOrigins_pass(String url) {
        assertThat(validator.isValid(url, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://evil.com/phishing-page",
            "https://evil.com/fake-login.png",
            "http://internal-service:8080/admin",
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "ftp://files.example.com/image.png",
            "/relative/path/image.png",
            "http://localhost:9001/different-port",
            "https://images.vnshop.com.evil.com/payload.png"
    })
    void disallowedOrigins_fail(String url) {
        assertThat(validator.isValid(url, null)).isFalse();
    }

    @Test
    void malformedUrl_fails() {
        assertThat(validator.isValid("not a url at all {}", null)).isFalse();
    }

    @Test
    void emptyAllowedOrigins_rejectsEverything() {
        var strict = new ImageUrlValidator(List.of());
        assertThat(strict.isValid("http://localhost:9000/image.jpg", null)).isFalse();
    }
}
