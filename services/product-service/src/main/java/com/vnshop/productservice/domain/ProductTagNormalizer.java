package com.vnshop.productservice.domain;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class ProductTagNormalizer {
    private final ProductTagPolicy policy;

    public ProductTagNormalizer(ProductTagPolicy policy) {
        this.policy = policy;
    }

    public List<ProductTag> normalize(List<String> rawTags) {
        if (rawTags == null || rawTags.isEmpty()) {
            return List.of();
        }
        if (rawTags.size() > policy.maxPerProduct()) {
            throw new IllegalArgumentException("product cannot have more than " + policy.maxPerProduct() + " tags");
        }

        Map<String, ProductTag> byKey = new LinkedHashMap<>();
        int totalLength = 0;
        for (String rawTag : rawTags) {
            String label = normalizeLabel(rawTag);
            String key = label.toLowerCase(Locale.ROOT);
            if (containsControlCharacter(key)) {
                throw new IllegalArgumentException("tag cannot contain control characters");
            }
            if (label.length() > policy.maxLength()) {
                throw new IllegalArgumentException("tag cannot be longer than " + policy.maxLength() + " characters");
            }
            if (byKey.putIfAbsent(key, new ProductTag(key, label)) == null) {
                totalLength += label.length();
            }
        }
        if (totalLength > policy.maxTotalLength()) {
            throw new IllegalArgumentException("product tags exceed the configured aggregate length");
        }
        return byKey.values().stream()
                .sorted(Comparator.comparing(ProductTag::canonicalKey))
                .toList();
    }

    private static String normalizeLabel(String rawTag) {
        if (rawTag == null) {
            throw new IllegalArgumentException("tag is required");
        }
        String normalized = Normalizer.normalize(rawTag, Normalizer.Form.NFKC)
                .trim()
                .replaceAll("\\s+", " ");
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("tag is required");
        }
        return normalized;
    }

    private static boolean containsControlCharacter(String value) {
        return value.chars().anyMatch(Character::isISOControl);
    }
}
