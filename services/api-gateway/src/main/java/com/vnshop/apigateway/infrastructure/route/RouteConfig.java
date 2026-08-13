package com.vnshop.apigateway.infrastructure.route;

import com.vnshop.apigateway.infrastructure.config.TieredRateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.GatewayFilterSpec;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The gateway is the public edge for the SPA and native cookie-auth boundary.
 * Keycloak remains network-internal; only the public OIDC protocol and static
 * login resources are selectively proxied when an external identity provider
 * flow is enabled. The admin console path is intentionally not routed.
 *
 * <p>The Authorization header is forwarded to downstream services automatically by
 * Spring Cloud Gateway, so dropping TokenRelay does not lose anything.
 *
 * <p>Rate limiting is per-route with tiered limits — authenticated users get higher
 * allowances than anonymous callers, and two users behind the same CGNAT IP each get
 * independent buckets because the key is the JWT {@code sub} claim, not the IP.
 * See {@link com.vnshop.apigateway.infrastructure.config.RateLimiterConfig} for the
 * per-route replenish/burst values and
 * {@link com.vnshop.apigateway.infrastructure.config.TieredKeyResolver} for the
 * key-resolution strategy.
 */
@Configuration
public class RouteConfig {

    private final String productServiceUri;
    private final String userServiceUri;
    private final String searchServiceUri;
    private final String inventoryServiceUri;
    private final String cartServiceUri;
    private final String orderServiceUri;
    private final String paymentServiceUri;
    private final String shippingServiceUri;
    private final String notificationServiceUri;
    private final String sellerFinanceServiceUri;
    private final String recommendationsServiceUri;
    private final String messagingServiceUri;
    private final String monitoringServiceUri;
    private final String configurationServiceUri;
    private final String couponServiceUri;
    private final String keycloakServiceUri;
    private final String configurationServiceToken;

    public RouteConfig(
        @Value("${vnshop.routes.product-service:http://product-service:8082}") String productServiceUri,
        @Value("${vnshop.routes.user-service:http://user-service:8081}") String userServiceUri,
        @Value("${vnshop.routes.search-service:http://search-service:8086}") String searchServiceUri,
        @Value("${vnshop.routes.inventory-service:http://inventory-service:8083}") String inventoryServiceUri,
        @Value("${vnshop.routes.cart-service:http://cart-service:8084}") String cartServiceUri,
        @Value("${vnshop.routes.order-service:http://order-service:8091}") String orderServiceUri,
        @Value("${vnshop.routes.payment-service:http://payment-service:8092}") String paymentServiceUri,
        @Value("${vnshop.routes.shipping-service:http://shipping-service:8093}") String shippingServiceUri,
        @Value("${vnshop.routes.notification-service:http://notification-service:8087}") String notificationServiceUri,
        @Value("${vnshop.routes.seller-finance-service:http://seller-finance-service:8090}") String sellerFinanceServiceUri,
        @Value("${vnshop.routes.recommendations-service:http://recommendations-service:8094}") String recommendationsServiceUri,
        @Value("${vnshop.routes.messaging-service:http://messaging-service:8095}") String messagingServiceUri,
        @Value("${vnshop.routes.monitoring-service:http://monitoring-service-v2:8096}") String monitoringServiceUri,
        @Value("${vnshop.routes.configuration-service:http://configuration-service:8097}") String configurationServiceUri,
        @Value("${vnshop.routes.coupon-service:http://coupon-service:8088}") String couponServiceUri,
        @Value("${vnshop.routes.keycloak:http://keycloak:8080}") String keycloakServiceUri,
        @Value("${CONFIG_SERVICE_INTERNAL_TOKEN:}") String configurationServiceToken
    ) {
        this.productServiceUri = productServiceUri;
        this.userServiceUri = userServiceUri;
        this.searchServiceUri = searchServiceUri;
        this.inventoryServiceUri = inventoryServiceUri;
        this.cartServiceUri = cartServiceUri;
        this.orderServiceUri = orderServiceUri;
        this.paymentServiceUri = paymentServiceUri;
        this.shippingServiceUri = shippingServiceUri;
        this.notificationServiceUri = notificationServiceUri;
        this.sellerFinanceServiceUri = sellerFinanceServiceUri;
        this.recommendationsServiceUri = recommendationsServiceUri;
        this.messagingServiceUri = messagingServiceUri;
        this.monitoringServiceUri = monitoringServiceUri;
        this.configurationServiceUri = configurationServiceUri;
        this.couponServiceUri = couponServiceUri;
        this.keycloakServiceUri = keycloakServiceUri;
        this.configurationServiceToken = configurationServiceToken;
    }

    @Bean
    RouteLocator gatewayRoutes(
        RouteLocatorBuilder builder,
        TieredRateLimiter paymentRateLimiter,
        TieredRateLimiter authRateLimiter,
        TieredRateLimiter searchRateLimiter,
        TieredRateLimiter flashSaleReserveRateLimiter,
        TieredRateLimiter flashSaleStockRateLimiter,
        TieredRateLimiter flashSaleActiveRateLimiter,
        TieredRateLimiter recommendationsRateLimiter,
        TieredRateLimiter generalRateLimiter,
        KeyResolver tieredKeyResolver
    ) {
        return builder.routes()
            // Only realm protocol endpoints and their static login assets are
            // public. /admin/** is deliberately absent, so the Keycloak admin
            // console cannot be reached through the gateway.
            .route("keycloak-oidc", route -> route.path("/realms/**", "/resources/**")
                .filters(filters -> rateLimited(filters, "keycloak", authRateLimiter, tieredKeyResolver))
                .uri(keycloakServiceUri))
            .route("products", route -> route.path("/products/**")
                .filters(filters -> rateLimited(filters, "product-service", generalRateLimiter, tieredKeyResolver))
                .uri(productServiceUri))
            .route("videos", route -> route.path("/videos/**")
                .filters(filters -> resilient(filters, "product-service"))
                .uri(productServiceUri))
            .route("categories", route -> route.path("/categories/**")
                .filters(filters -> resilient(filters, "product-service"))
                .uri(productServiceUri))
            .route("search", route -> route.path("/search/**")
                .filters(filters -> rateLimited(filters, "search-service", searchRateLimiter, tieredKeyResolver))
                .uri(searchServiceUri))
            // /inventory/** route was removed in Phase 3C: inventory-service exposes
            // only gRPC (Reserve/Release) and the flash-sale REST endpoint below.
            // Stock for product detail is now served by product-service directly via
            // ProductResponse.stock; no public HTTP /inventory/* endpoint exists.
            .route("flash-sale-reserve", route -> route.path("/flash-sale/reserve")
                .filters(filters -> rateLimited(filters, "inventory-service", flashSaleReserveRateLimiter, tieredKeyResolver))
                .uri(inventoryServiceUri))
            .route("flash-sale-stock", route -> route.path("/flash-sale/stock/**")
                .filters(filters -> rateLimited(filters, "inventory-service", flashSaleStockRateLimiter, tieredKeyResolver))
                .uri(inventoryServiceUri))
            .route("flash-sale-active", route -> route.path("/flash-sale/active")
                .filters(filters -> rateLimited(filters, "inventory-service", flashSaleActiveRateLimiter, tieredKeyResolver))
                .uri(inventoryServiceUri))
            .route("flash-sale", route -> route.path("/flash-sale/**")
                .filters(filters -> resilient(filters, "inventory-service"))
                .uri(inventoryServiceUri))
            .route("questions", route -> route.path("/questions/**")
                .filters(filters -> resilient(filters, "product-service"))
                .uri(productServiceUri))
            // Seller-owned product CRUD + image upload routes live on product-service.
            // Must precede the broader /sellers/** route below (which targets user-service
            // for seller profile/onboarding endpoints).
            .route("seller-products", route -> route.path("/sellers/me/products/**")
                .filters(filters -> resilient(filters, "product-service"))
                .uri(productServiceUri))
            // Seller analytics — daily revenue/order-count aggregate scoped to the
            // caller's sellerId. Lives on order-service. Must precede /sellers/**.
            .route("seller-analytics", route -> route.path("/sellers/me/revenue", "/sellers/me/analytics/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            // Seller finance — wallet balance + payout history/requests for the
            // caller. Lives on seller-finance-service. Must precede /sellers/**.
            .route("seller-finance-me", route -> route.path("/sellers/me/finance/**")
                .filters(filters -> resilient(filters, "seller-finance-service"))
                .uri(sellerFinanceServiceUri))
            .route("users", route -> route.path("/users/**", "/sellers/**")
                .filters(filters -> resilient(filters, "user-service"))
                .uri(userServiceUri))
            // Public self-registration. SecurityConfig permits /auth/** without a
            // bearer token; the controller in user-service proxies to Keycloak's
            // Admin API to create the user, then materialises the buyer profile.
            .route("auth", route -> route.path("/auth/**")
                .filters(filters -> rateLimited(filters, "user-service", authRateLimiter, tieredKeyResolver))
                .uri(userServiceUri))
            .route("cart", route -> route.path("/cart/**")
                .filters(filters -> resilient(filters, "cart-service"))
                .uri(cartServiceUri))
            // Seller fulfilment endpoints (accept/reject/ship sub-orders) live on
            // order-service. Path is /seller/orders/** (singular), distinct from the
            // /sellers/** profile/onboarding routes above.
            .route("seller-orders", route -> route.path("/seller/orders/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            // Coupon validation and consumption belong to coupon-service even
            // though the API keeps the checkout URL for the buyer workflow.
            // Keep this specific route before the general checkout route.
            .route("checkout-coupons", route -> route.path("/checkout/validate-coupon", "/checkout/apply-coupon")
                .filters(filters -> resilient(filters, "coupon-service"))
                .uri(couponServiceUri))
            .route("checkout", route -> route.path("/checkout/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            .route("returns", route -> route.path("/returns/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            .route("invoices", route -> route.path("/invoices/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            .route("orders", route -> route.path("/orders/**")
                .filters(filters -> rateLimited(filters, "order-service", generalRateLimiter, tieredKeyResolver))
                .uri(orderServiceUri))
            .route("payment", route -> route.path("/payment/**")
                .filters(filters -> rateLimited(filters, "payment-service", paymentRateLimiter, tieredKeyResolver))
                .uri(paymentServiceUri))
            .route("shipping", route -> route.path("/shipping/**")
                .filters(filters -> resilient(filters, "shipping-service"))
                .uri(shippingServiceUri))
            .route("shipping-webhooks", route -> route.path("/webhooks/ghn", "/webhooks/ghtk")
                .filters(filters -> rateLimited(filters, "shipping-service", generalRateLimiter, tieredKeyResolver))
                .uri(shippingServiceUri))
            .route("notifications", route -> route.path("/notifications/**")
                .filters(filters -> resilient(filters, "notification-service"))
                .uri(notificationServiceUri))
            // Notification WebSocket upgrade. Circuit breaker intentionally omitted
            // for the same reason as messaging-ws: Resilience4j doesn't reliably wrap
            // the Upgrade lifecycle and would surface 5xx during reconnect storms.
            .route("notifications-ws", route -> route.path("/ws/notifications/**")
                .uri(notificationServiceUri))
            // Buyer-seller messaging (REST). The matching WebSocket upgrade lives on
            // /ws/messaging — Spring Cloud Gateway proxies HTTP-Upgrade requests
            // through to the downstream `http://` URI without extra config. The circuit
            // breaker is intentionally omitted on the ws route because Resilience4j's
            // ReactiveCircuitBreaker doesn't reliably wrap the Upgrade lifecycle and
            // would surface 5xx during a reconnect storm; the FE handles reconnects.
            .route("messaging", route -> route.path("/messaging/**")
                .filters(filters -> resilient(filters, "messaging-service"))
                .uri(messagingServiceUri))
            .route("messaging-ws", route -> route.path("/ws/messaging")
                .uri(messagingServiceUri))
            .route("coupons", route -> route.path("/coupons/**")
                .filters(filters -> resilient(filters, "coupon-service"))
                .uri(couponServiceUri))
            .route("reviews", route -> route.path("/reviews/**")
                .filters(filters -> resilient(filters, "product-service"))
                .uri(productServiceUri))
            .route("seller-finance", route -> route.path("/seller-finance/**")
                .filters(filters -> resilient(filters, "seller-finance-service"))
                .uri(sellerFinanceServiceUri))
            // Recommendations endpoints (frequently-bought-together, you-may-also-like)
            // are public reads — no rate limit, just a circuit breaker so a slow
            // recommendations-service can't stall product detail page renders.
            .route("recommendations", route -> route.path("/recommendations/**")
                .filters(filters -> rateLimited(filters, "recommendations-service", recommendationsRateLimiter, tieredKeyResolver))
                .uri(recommendationsServiceUri))
            // Actuator proxy routes for the FE admin health-check panel.
            // stripPrefix(1) removes /<svc> so downstream receives /actuator/health etc.
            .route("actuator-user-service", route -> route.path("/user-service/actuator/**")
                .filters(filters -> filters.stripPrefix(1))
                .uri(userServiceUri))
            .route("actuator-order-service", route -> route.path("/order-service/actuator/**")
                .filters(filters -> filters.stripPrefix(1))
                .uri(orderServiceUri))
            .route("actuator-payment-service", route -> route.path("/payment-service/actuator/**")
                .filters(filters -> filters.stripPrefix(1))
                .uri(paymentServiceUri))
            .route("actuator-product-service", route -> route.path("/product-service/actuator/**")
                .filters(filters -> filters.stripPrefix(1))
                .uri(productServiceUri))
            // notification-service is NestJS — health at /health, not /actuator/health
            .route("health-notification-service", route -> route.path("/notification-service/health")
                .filters(filters -> filters.stripPrefix(1))
                .uri(notificationServiceUri))
            // Configuration service — public app config endpoint.
            .route("configuration-reload", route -> route.path("/api/config/reload")
                .filters(filters -> filters.addRequestHeader("x-config-service-token", configurationServiceToken))
                .uri(configurationServiceUri))
            .route("configuration", route -> route.path("/api/config", "/api/config/public")
                .uri(configurationServiceUri))
            // Admin sub-routes — more specific patterns must come before the
            // catch-all /admin/** route below. Each maps to the service that owns
            // the corresponding domain endpoints.
            .route("admin-dashboard", route -> route.path("/admin/dashboard/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            .route("admin-disputes", route -> route.path("/admin/disputes/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            .route("admin-orders", route -> route.path("/admin/orders/**")
                .filters(filters -> resilient(filters, "order-service"))
                .uri(orderServiceUri))
            .route("admin-coupons", route -> route.path("/admin/coupons/**")
                .filters(filters -> resilient(filters, "coupon-service"))
                .uri(couponServiceUri))
            .route("admin-finance", route -> route.path("/admin/finance/**")
                .filters(filters -> resilient(filters, "seller-finance-service"))
                .uri(sellerFinanceServiceUri))
            .route("admin-reviews", route -> route.path("/admin/reviews/**")
                .filters(filters -> resilient(filters, "product-service"))
                .uri(productServiceUri))
            // Admin manual VietQR confirmation lives on payment-service. Must
            // precede the catch-all /admin/** below.
            .route("admin-vietqr", route -> route.path("/admin/vietqr/**")
                .filters(filters -> resilient(filters, "payment-service"))
                .uri(paymentServiceUri))
            // Admin video moderation endpoints live on product-service. Must
            // precede the catch-all /admin/** below.
            .route("admin-videos", route -> route.path("/admin/videos/**")
                .filters(filters -> resilient(filters, "product-service"))
                .uri(productServiceUri))
            .route("monitoring", route -> route.path("/monitoring/**")
                .filters(filters -> resilient(filters, "monitoring-service"))
                .uri(monitoringServiceUri))
            .route("admin", route -> route.path("/admin/**")
                .filters(filters -> resilient(filters, "user-service"))
                .uri(userServiceUri))
            .build();
    }

    private GatewayFilterSpec resilient(GatewayFilterSpec filters, String service) {
        return filters.circuitBreaker(config -> config
            .setName(service)
            .setFallbackUri("forward:/fallback/" + service));
    }

    private GatewayFilterSpec rateLimited(
        GatewayFilterSpec filters,
        String service,
        TieredRateLimiter rateLimiter,
        KeyResolver keyResolver
    ) {
        return filters
            .requestRateLimiter(config -> config
                .setRateLimiter(rateLimiter)
                .setKeyResolver(keyResolver))
            .circuitBreaker(config -> config
                .setName(service)
                .setFallbackUri("forward:/fallback/" + service));
    }
}
