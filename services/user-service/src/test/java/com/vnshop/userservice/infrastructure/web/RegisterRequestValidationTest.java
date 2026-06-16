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
 * optional, but if supplied it must be a valid Vietnamese E.164 number
 * (+84 followed by 9-10 digits). Bad shapes used to slip through to the
 * buyer profile and crash downstream consumers that tried to parse them,
 * so the constraint now lives at the request boundary.
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
    void validE164Phone_isAllowed() {
        assertThat(validator.validate(withPhone("+84912345678"))).isEmpty();
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
    void missingCountryCode_isRejected() {
        assertPhoneViolation(validator.validate(withPhone("0912345678")));
    }

    @Test
    void wrongCountryCode_isRejected() {
        assertPhoneViolation(validator.validate(withPhone("+12025551234")));
    }

    @Test
    void lettersInsideNumber_isRejected() {
        assertPhoneViolation(validator.validate(withPhone("+84912abc678")));
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
