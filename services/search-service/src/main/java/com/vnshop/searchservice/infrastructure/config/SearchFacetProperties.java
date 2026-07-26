package com.vnshop.searchservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "search.facets")
public record SearchFacetProperties(int maxBuckets) {
    public SearchFacetProperties {
        if (maxBuckets < 1) {
            throw new IllegalArgumentException("search.facets.max-buckets must be positive");
        }
    }
}
