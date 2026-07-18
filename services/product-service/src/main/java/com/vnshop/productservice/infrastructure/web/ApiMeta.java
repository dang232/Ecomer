package com.vnshop.productservice.infrastructure.web;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiMeta(String requestId, String cacheStatus, boolean stale, String nextCursor, Boolean hasMore) {
}
