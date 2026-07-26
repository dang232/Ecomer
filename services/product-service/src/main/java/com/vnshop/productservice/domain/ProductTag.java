package com.vnshop.productservice.domain;

/** A public seller tag with a stable key for filtering and a display label for clients. */
public record ProductTag(String canonicalKey, String displayLabel) {
    public ProductTag {
        canonicalKey = requireText(canonicalKey, "canonicalKey");
        displayLabel = requireText(displayLabel, "displayLabel");
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value;
    }
}
