package com.vnshop.apigateway.infrastructure.route;

final class CatalogRouteModule {
    private CatalogRouteModule() {}

    static void add(org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder.Builder routes,
            RouteDependencies d) {
        routes.route("products", r -> r.path(RoutePaths.versioned("/products/**"))
                .filters(f -> d.rateLimited(f, "product-service", d.generalLimiter())).uri(d.product()))
            .route("videos", r -> r.path(RoutePaths.versioned("/videos/**")).filters(f -> d.resilient(f, "product-service")).uri(d.product()))
            .route("categories", r -> r.path(RoutePaths.versioned("/categories/**")).filters(f -> d.resilient(f, "product-service")).uri(d.product()))
            .route("search", r -> r.path(RoutePaths.versioned("/search/**")).filters(f -> d.rateLimited(f, "search-service", d.searchLimiter())).uri(d.search()))
            .route("flash-sale-reserve", r -> r.path(RoutePaths.versioned("/flash-sale/reserve"))
                    .filters(f -> d.rateLimited(f, "inventory-service", d.flashReserveLimiter())).uri(d.inventory()))
            .route("flash-sale-stock", r -> r.path(RoutePaths.versioned("/flash-sale/stock/**"))
                    .filters(f -> d.rateLimited(f, "inventory-service", d.flashStockLimiter())).uri(d.inventory()))
            .route("flash-sale-active", r -> r.path(RoutePaths.versioned("/flash-sale/active"))
                    .filters(f -> d.rateLimited(f, "inventory-service", d.flashActiveLimiter())).uri(d.inventory()))
            .route("flash-sale", r -> r.path(RoutePaths.versioned("/flash-sale/**")).filters(f -> d.resilient(f, "inventory-service")).uri(d.inventory()))
            .route("questions", r -> r.path(RoutePaths.versioned("/questions/**")).filters(f -> d.resilient(f, "product-service")).uri(d.product()))
            .route("seller-products", r -> r.path(RoutePaths.versioned("/sellers/me/products/**"))
                    .filters(f -> d.resilient(f, "product-service")).uri(d.product()))
            .route("reviews", r -> r.path(RoutePaths.versioned("/reviews/**")).filters(f -> d.resilient(f, "product-service")).uri(d.product()));
    }
}
