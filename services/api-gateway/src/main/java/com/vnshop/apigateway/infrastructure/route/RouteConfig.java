package com.vnshop.apigateway.infrastructure.route;

import com.vnshop.apigateway.infrastructure.config.PublicBucketProperties;
import com.vnshop.apigateway.infrastructure.config.TieredRateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(PublicBucketProperties.class)
public class RouteConfig {
    private final RouteDependencies dependencies;

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
            @Value("${vnshop.routes.minio:http://minio:9000}") String minioServiceUri,
            @Value("${CONFIG_SERVICE_INTERNAL_TOKEN:}") String configurationServiceToken,
            PublicBucketProperties publicBuckets) {
        this.dependencies = new RouteDependencies(productServiceUri, userServiceUri, searchServiceUri,
                inventoryServiceUri, cartServiceUri, orderServiceUri, paymentServiceUri, shippingServiceUri,
                notificationServiceUri, sellerFinanceServiceUri, recommendationsServiceUri, messagingServiceUri,
                monitoringServiceUri, configurationServiceUri, couponServiceUri, keycloakServiceUri, minioServiceUri,
                configurationServiceToken, publicBuckets);
    }

    @Bean
    RouteLocator gatewayRoutes(RouteLocatorBuilder builder,
            TieredRateLimiter paymentRateLimiter, TieredRateLimiter authRateLimiter,
            TieredRateLimiter searchRateLimiter, TieredRateLimiter flashSaleReserveRateLimiter,
            TieredRateLimiter flashSaleStockRateLimiter, TieredRateLimiter flashSaleActiveRateLimiter,
            TieredRateLimiter recommendationsRateLimiter, TieredRateLimiter generalRateLimiter,
            KeyResolver tieredKeyResolver) {
        RouteDependencies routes = dependencies.withLimiters(paymentRateLimiter, authRateLimiter, searchRateLimiter,
                flashSaleReserveRateLimiter, flashSaleStockRateLimiter, flashSaleActiveRateLimiter,
                recommendationsRateLimiter, generalRateLimiter, tieredKeyResolver);
        RouteLocatorBuilder.Builder ordered = builder.routes();
        IdentityRouteModule.add(ordered, routes);
        CatalogRouteModule.add(ordered, routes);
        CommerceRouteModule.add(ordered, routes);
        return ordered.build();
    }
}
