package com.vnshop.userservice.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;

class InputSanitizerTest {

    // --- stripHtml ---

    @Test
    void stripHtml_nullInput_returnsNull() {
        assertThat(InputSanitizer.stripHtml(null)).isNull();
    }

    @Test
    void stripHtml_plainText_unchanged() {
        assertThat(InputSanitizer.stripHtml("Alice")).isEqualTo("Alice");
    }

    @Test
    void stripHtml_scriptTag_stripped() {
        assertThat(InputSanitizer.stripHtml("Alice<script>alert(1)</script>"))
                .isEqualTo("Alicealert(1)");
    }

    @Test
    void stripHtml_boldTag_stripped() {
        assertThat(InputSanitizer.stripHtml("<b>Bob</b>")).isEqualTo("Bob");
    }

    @Test
    void stripHtml_imgOnerrorPayload_stripped() {
        assertThat(InputSanitizer.stripHtml("<img src=x onerror=alert(1)>"))
                .isEqualTo("");
    }

    // --- validateAvatarUrl ---

    @Test
    void validateAvatarUrl_null_passes() {
        assertThatNoException().isThrownBy(() -> InputSanitizer.validateAvatarUrl(null));
    }

    @Test
    void validateAvatarUrl_blank_passes() {
        assertThatNoException().isThrownBy(() -> InputSanitizer.validateAvatarUrl("  "));
    }

    @Test
    void validateAvatarUrl_validHttps_passes() {
        assertThatNoException().isThrownBy(
                () -> InputSanitizer.validateAvatarUrl("https://cdn.example.com/avatar.jpg"));
    }

    @Test
    void validateAvatarUrl_validHttp_passes() {
        assertThatNoException().isThrownBy(
                () -> InputSanitizer.validateAvatarUrl("http://cdn.example.com/avatar.jpg"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "ftp://cdn.example.com/avatar.jpg",
            "file:///etc/passwd",
            "javascript:alert(1)"
    })
    void validateAvatarUrl_nonHttpScheme_throws(String url) {
        assertThatThrownBy(() -> InputSanitizer.validateAvatarUrl(url))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("http or https scheme");
    }

    @Test
    void validateAvatarUrl_dataUri_throws() {
        // data: URIs contain angle brackets which fail URI parsing — still rejected
        assertThatThrownBy(() -> InputSanitizer.validateAvatarUrl("data:text/html,<h1>xss</h1>"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://10.0.0.1/steal",
            "http://10.255.255.255/",
            "http://172.16.0.1/",
            "http://172.31.0.1/",
            "http://192.168.1.1/",
            "http://127.0.0.1/",
            "http://0.0.0.0/",
            "http://169.254.169.254/latest/meta-data/"
    })
    void validateAvatarUrl_privateIp_throws(String url) {
        assertThatThrownBy(() -> InputSanitizer.validateAvatarUrl(url))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("private or internal IP");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://localhost/admin",
            "http://metadata/",
            "http://internalhost/secret"
    })
    void validateAvatarUrl_internalHostname_throws(String url) {
        assertThatThrownBy(() -> InputSanitizer.validateAvatarUrl(url))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("disallowed internal host");
    }

    @Test
    void validateAvatarUrl_malformedUrl_throws() {
        assertThatThrownBy(() -> InputSanitizer.validateAvatarUrl("not a url ://"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
