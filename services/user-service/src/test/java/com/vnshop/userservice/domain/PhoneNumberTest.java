package com.vnshop.userservice.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneNumberTest {

    @Test
    void validVietnameseNumber_createsSuccessfully() {
        PhoneNumber p = new PhoneNumber("+84912345678");
        assertThat(p.value()).isEqualTo("+84912345678");
    }

    @Test
    void validUsNumber_createsSuccessfully() {
        // The BE accepts any E.164 shape; country-aware validation is the FE's
        // responsibility (via libphonenumber-js).
        PhoneNumber p = new PhoneNumber("+12025551234");
        assertThat(p.value()).isEqualTo("+12025551234");
    }

    @Test
    void validUkNumber_createsSuccessfully() {
        PhoneNumber p = new PhoneNumber("+442071838750");
        assertThat(p.value()).isEqualTo("+442071838750");
    }

    @Test
    void nullValue_throwsNullPointer() {
        assertThatThrownBy(() -> new PhoneNumber(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void invalidFormat_noPlusSign_throwsIllegalArgument() {
        assertThatThrownBy(() -> new PhoneNumber("0912345678"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E.164");
    }

    @Test
    void invalidFormat_letters_throwsIllegalArgument() {
        assertThatThrownBy(() -> new PhoneNumber("+banana"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E.164");
    }

    @Test
    void invalidFormat_leadingZeroCountryCode_throwsIllegalArgument() {
        // Country codes cannot start with 0 in E.164.
        assertThatThrownBy(() -> new PhoneNumber("+0123456789"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E.164");
    }

    @Test
    void invalidFormat_tooShort_throwsIllegalArgument() {
        // E.164 requires at least 5 digits after the +.
        assertThatThrownBy(() -> new PhoneNumber("+123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E.164");
    }

    @Test
    void invalidFormat_moreThanFifteenDigitsAfterPlus_throwsIllegalArgument() {
        // ITU-T E.164 caps the complete international number at 15 digits.
        assertThatThrownBy(() -> new PhoneNumber("+8491234567890123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E.164");
    }

    // --- parseOrNull: the FE/controller-facing factory that owns the
    //     null/blank-tolerance rule so callers don't re-derive it. ---

    @Test
    void parseOrNull_nullReturnsNull() {
        assertThat(PhoneNumber.parseOrNull(null)).isNull();
    }

    @Test
    void parseOrNull_blankReturnsNull() {
        assertThat(PhoneNumber.parseOrNull("")).isNull();
        assertThat(PhoneNumber.parseOrNull("   ")).isNull();
    }

    @Test
    void parseOrNull_validReturnsValidatedInstance() {
        assertThat(PhoneNumber.parseOrNull("+84912345678").value()).isEqualTo("+84912345678");
    }

    @Test
    void parseOrNull_trimsSurroundingWhitespace() {
        assertThat(PhoneNumber.parseOrNull("  +84912345678  ").value()).isEqualTo("+84912345678");
    }

    @Test
    void parseOrNull_invalidThrows() {
        assertThatThrownBy(() -> new PhoneNumber("+banana"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E.164");
    }
}
