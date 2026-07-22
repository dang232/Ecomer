package com.vnshop.orderservice.infrastructure.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class UserDirectoryHttpClientAdapter implements UserDirectoryPort {
    private static final Logger log = LoggerFactory.getLogger(UserDirectoryHttpClientAdapter.class);

    private final UserDirectoryHttpClient client;
    private final ObjectMapper objectMapper;

    public UserDirectoryHttpClientAdapter(UserDirectoryHttpClient client, ObjectMapper objectMapper) {
        this.client = client;
        this.objectMapper = objectMapper;
    }

    @Override
    public DirectorySnapshot lookup(Set<String> buyerIds, Set<String> sellerIds) {
        Map<String, String> buyers = lookupProfiles(buyerIds, client::listBuyerProfiles, "userId");
        Map<String, String> sellers = lookupProfiles(sellerIds, client::listSellerProfiles, "sellerId");
        return new DirectorySnapshot(buyers, sellers);
    }

    private Map<String, String> lookupProfiles(
            Set<String> ids,
            ProfileLookup lookup,
            String idField) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        try {
            String body = lookup.call(ids.stream().toList());
            if (body == null || body.isBlank()) {
                return Map.of();
            }
            JsonNode root = objectMapper.readTree(body);
            JsonNode data = root.has("data") ? root.path("data") : root;
            if (!data.isArray()) {
                return Map.of();
            }
            Map<String, String> result = new HashMap<>();
            for (JsonNode node : data) {
                String id = node.path(idField).asText(null);
                String displayName = node.path("displayName").asText(null);
                if (id != null && !id.isBlank() && displayName != null && !displayName.isBlank()) {
                    result.put(id, displayName);
                }
            }
            return result;
        } catch (Exception ex) {
            log.warn("user-service directory lookup failed (idsCount={}): {}", ids.size(), ex.getMessage());
            return Map.of();
        }
    }

    @FunctionalInterface
    private interface ProfileLookup {
        String call(List<String> ids);
    }
}
