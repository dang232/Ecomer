package com.vnshop.userservice.domain;

import java.util.Objects;

/**
 * Buyer's full name. Owns the "firstName + ' ' + lastName, trimmed" composition
 * rule so the web adapter stops concatenating strings inline. Both
 * {@link #firstName()} and {@link #lastName()} are trimmed of surrounding
 * whitespace; {@link #value()} is the composed form.
 *
 * <p>For the upsert path (single composed-name field from the FE), use
 * {@link #fromComposed(String)} to wrap an already-composed name; the
 * {@code firstName} becomes the whole name and {@code lastName} is empty.</p>
 */
public record FullName(String firstName, String lastName, String value) {

    public FullName {
        Objects.requireNonNull(firstName, "firstName is required");
        Objects.requireNonNull(lastName, "lastName is required");
        if (firstName.isBlank()) {
            throw new IllegalArgumentException("firstName is required");
        }
        // lastName MAY be blank (see fromComposed); the composed `value` is
        // the trimmed concatenation with a single space.
        firstName = firstName.trim();
        lastName = lastName.trim();
        value = lastName.isEmpty() ? firstName : (firstName + " " + lastName);
    }

    /** Compose a name from separate first/last inputs (the register-path shape). */
    public static FullName of(String firstName, String lastName) {
        String fn = firstName == null ? "" : firstName.trim();
        String ln = lastName == null ? "" : lastName.trim();
        return new FullName(fn, ln, ln.isEmpty() ? fn : (fn + " " + ln));
    }

    /**
     * Wrap a pre-composed name string (the upsert-path shape). The whole name
     * lands in {@code firstName}; {@code lastName} is empty. Useful when the
     * caller has a single full-name field rather than a first/last split.
     */
    public static FullName fromComposed(String composedName) {
        if (composedName == null || composedName.isBlank()) {
            throw new IllegalArgumentException("composed name is required");
        }
        String trimmed = composedName.trim();
        return new FullName(trimmed, "", trimmed);
    }
}
