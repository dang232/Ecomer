package com.vnshop.userservice.infrastructure.web;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bean Validation tests for {@link RegisterRequest}. The phone field is
 * optional, but if supplied it must be a valid E.164 international number
 * ({@code +} followed by 5-19 digits). The BE's only job at this boundary
 * is shape validation — country-aware "is this a real number in this
 * country?" lives on the FE (libphonenumber-js). The DTO rejects bad
 * shapes so they don't slip through to the buyer profile and crash
 * downstream consumers.
 */
class RegisterRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void initValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeFactory() {
        if (factory != null) factory.close();
    }

    private static final String VALID_EMAIL = "alice@example.com";
    private static final String VALID_PASSWORD = "Password1";
    private static final String VALID_FIRST = "Alice";
    private static final String VALID_LAST = "Nguyen";

    /** A baseline valid request — overrides supply the field under test. */
    private static RegisterRequest base() {
        return new RegisterRequest(VALID_EMAIL, VALID_PASSWORD, VALID_FIRST, VALID_LAST, null);
    }

    /** Builder-style helper: same as base() but with the phone field set. */
    private static RegisterRequest withPhone(String phone) {
        return new RegisterRequest(VALID_EMAIL, VALID_PASSWORD, VALID_FIRST, VALID_LAST, phone);
    }

    @Test
    void nullPhone_isAllowed() {
        assertThat(validator.validate(base())).isEmpty();
    }

    @Test
    void blankPhone_isAllowed() {
        assertThat(validator.validate(withPhone("   "))).isEmpty();
    }

    @Test
    void validVietnamesePhone_isAllowed() {
        assertThat(validator.validate(withPhone("+84912345678"))).isEmpty();
    }

    @Test
    void validUsPhone_isAllowed() {
        // The BE accepts any E.164 shape; country-aware validation is the FE's.
        assertThat(validator.validate(withPhone("+12025551234"))).isEmpty();
    }

    @Test
    void validUkPhone_isAllowed() {
        assertThat(validator.validate(withPhone("+442071838750"))).isEmpty();
    }

    @Test
    void freeFormText_isRejected() {
        // The exact bug the user hit: any word could be entered as the
        // phone number. Must be rejected with the E.164 message.
        Set<ConstraintViolation<RegisterRequest>> violations =
                validator.validate(withPhone("banana"));
        assertPhoneViolation(violations);
    }

    @Test
    void missingPlusSign_isRejected() {
        assertPhoneViolation(validator.validate(withPhone("0912345678")));
    }

    @Test
    void leadingZeroCountryCode_isRejected() {
        // E.164 country codes cannot start with 0.
        assertPhoneViolation(validator.validate(withPhone("+0123456789")));
    }

    @Test
    void lettersInsideNumber_isRejected() {
        assertPhoneViolation(validator.validate(withPhone("+84912abc678")));
    }

    @Test
    void tooShort_isRejected() {
        // E.164 requires at least 5 digits after the +.
        assertPhoneViolation(validator.validate(withPhone("+123")));
    }

    private static void assertPhoneViolation(Set<ConstraintViolation<RegisterRequest>> violations) {
        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("phone");
        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .anyMatch(m -> m != null && m.contains("E.164"));
    }
}
