package com.vnshop.orderservice.infrastructure.config;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;
import java.util.Map;

public final class JwtPrincipalUtil {
    private JwtPrincipalUtil() {
    }

    public static String currentUserId() {
        Jwt jwt = currentJwt();
        return jwt.getClaimAsString("sub");
    }

    public static String currentSellerId() {
        Jwt jwt = currentJwt();
        return jwt.getClaimAsString("sub");
    }

    /**
     * Returns the caller's effective role as a single string — only
     * "ADMIN" or "SELLER" are surfaced today. Used by the return-approval
     * flow to short-circuit seller-ownership checks when an admin
     * mediates a cross-seller return.
     */
    public static String currentActorRole() {
        if (hasRole("ADMIN")) return "ADMIN";
        if (hasRole("SELLER")) return "SELLER";
        return "BUYER";
    }

    public static boolean hasRole(String role) {
        Jwt jwt = currentJwt();
        return hasRealmRole(jwt, role) || hasResourceRole(jwt, role);
    }

    private static Jwt currentJwt() {
        return (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private static boolean hasRealmRole(Jwt jwt, String role) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) {
            return false;
        }
        return containsRole(realmAccess.get("roles"), role);
    }

    private static boolean hasResourceRole(Jwt jwt, String role) {
        Map<String, Object> resourceAccess = jwt.getClaim("resource_access");
        if (resourceAccess == null) {
            return false;
        }
        return resourceAccess.values().stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .anyMatch(access -> containsRole(access.get("roles"), role));
    }

    private static boolean containsRole(Object roles, String role) {
        return roles instanceof Collection<?> collection && collection.stream()
                .map(Object::toString)
                .anyMatch(role::equalsIgnoreCase);
    }
}
