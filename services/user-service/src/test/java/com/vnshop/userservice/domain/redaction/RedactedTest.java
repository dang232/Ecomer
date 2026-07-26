package com.vnshop.userservice.domain.redaction;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RedactedTest {

    @Test
    void mask_returnsLengthTaggedMarker() {
        assertThat(Redacted.mask("1234567890")).isEqualTo("[REDACTED:10]");
    }

    @Test
    void mask_null_returnsNullMarker() {
        assertThat(Redacted.mask(null)).isEqualTo("[REDACTED-NULL]");
    }

    @Test
    void mask_empty_returnsZeroMarker() {
        assertThat(Redacted.mask("")).isEqualTo("[REDACTED:0]");
    }

    @Test
    void last4_keepsTailOfLongerInput() {
        assertThat(Redacted.last4("1234567890")).isEqualTo("****7890");
    }

    @Test
    void last4_shortInput_returnsAll() {
        assertThat(Redacted.last4("12")).isEqualTo("****12");
    }

    @Test
    void last4_nullOrBlank_returnsStars() {
        assertThat(Redacted.last4(null)).isEqualTo("****");
        assertThat(Redacted.last4("")).isEqualTo("****");
        assertThat(Redacted.last4("   ")).isEqualTo("****");
    }

    @Test
    void fingerprint_shortHex_returnedAsIs() {
        assertThat(Redacted.fingerprint("deadbeef")).isEqualTo("deadbeef");
    }

    @Test
    void fingerprint_longHex_truncatedWithEllipsis() {
        assertThat(Redacted.fingerprint("0123456789abcdef0123456789abcdef"))
                .isEqualTo("01234567…cdef");
    }

    @Test
    void fingerprint_nullOrBlank_returnsNoMarker() {
        assertThat(Redacted.fingerprint(null)).isEqualTo("[NO-FINGERPRINT]");
        assertThat(Redacted.fingerprint("")).isEqualTo("[NO-FINGERPRINT]");
    }
}