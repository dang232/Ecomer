package com.vnshop.apigateway.infrastructure.route;

final class IdentityRouteModule {
    private IdentityRouteModule() {}

    static void add(org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder.Builder routes,
            RouteDependencies d) {
        routes.route("keycloak-oidc", r -> r.path("/realms/**", "/resources/**")
                .filters(f -> d.rateLimited(f, "keycloak", d.authLimiter())).uri(d.keycloak()))
            .route("minio-public", r -> r.path(d.publicBuckets().routePatterns()).filters(f -> f.preserveHostHeader()
                    .dedupeResponseHeader("Access-Control-Allow-Credentials Access-Control-Allow-Origin", "RETAIN_FIRST"))
                    .uri(d.minio()))
            .route("configuration-reload", r -> r.path("/api/config/reload")
                    .filters(f -> f.addRequestHeader("x-config-service-token", d.configToken())).uri(d.configuration()))
            .route("configuration", r -> r.path("/api/config", "/api/config/public").uri(d.configuration()));
    }
}
