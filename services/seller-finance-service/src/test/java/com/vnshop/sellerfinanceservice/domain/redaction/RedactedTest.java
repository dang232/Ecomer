package com.vnshop.sellerfinanceservice.domain.redaction;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RedactedTest {

    @Test
    void mask_keepsLast4() {
        assertThat(Redacted.mask("1234567890")).isEqualTo("****7890");
    }

    @Test
    void mask_nullOrBlank_returnsStars() {
        assertThat(Redacted.mask(null)).isEqualTo("****");
        assertThat(Redacted.mask("")).isEqualTo("****");
        assertThat(Redacted.mask("   ")).isEqualTo("****");
    }

    @Test
    void last4_truncatesTail() {
        assertThat(Redacted.last4("ABC-1234")).isEqualTo("1234");
    }

    @Test
    void last4_tooShort_returnsStars() {
        assertThat(Redacted.last4("1")).isEqualTo("****");
        assertThat(Redacted.last4(null)).isEqualTo("****");
    }

    @Test
    void fingerprint_returnsEightCharPrefix() {
        assertThat(Redacted.fingerprint("0123456789abcdef0123456789abcdef"))
                .isEqualTo("01234567");
    }

    @Test
    void fingerprint_nullOrBlank_returnsNone() {
        assertThat(Redacted.fingerprint(null)).isEqualTo("<none>");
        assertThat(Redacted.fingerprint("")).isEqualTo("<none>");
    }
}