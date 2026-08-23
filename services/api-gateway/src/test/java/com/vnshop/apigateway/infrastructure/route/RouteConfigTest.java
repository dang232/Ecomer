package com.vnshop.apigateway.infrastructure.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.apigateway.infrastructure.config.TieredRateLimiter;
import com.vnshop.apigateway.infrastructure.config.PublicBucketProperties;
import java.net.URI;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.webflux.autoconfigure.WebFluxProperties;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.RequestRateLimiterGatewayFilterFactory;
import org.springframework.cloud.gateway.filter.factory.SpringCloudCircuitBreakerFilterFactory;
import org.springframework.cloud.gateway.filter.factory.StripPrefixGatewayFilterFactory;
import org.springframework.cloud.gateway.filter.factory.AddRequestHeaderGatewayFilterFactory;
import org.springframework.cloud.gateway.filter.factory.DedupeResponseHeaderGatewayFilterFactory;
import org.springframework.cloud.gateway.filter.factory.PreserveHostHeaderGatewayFilterFactory;
import org.springframework.cloud.gateway.handler.predicate.PathRoutePredicateFactory;
import org.springframework.cloud.gateway.handler.predicate.PathRoutePredicateFactory.Config;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import reactor.core.publisher.Mono;

class RouteConfigTest {

    @Test
    void v2CatalogPathsForwardToTheirOwningServicesAndFlashRoutesStaySpecific() {
        ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
        PathRoutePredicateFactory pathFactory = new PathRoutePredicateFactory(new WebFluxProperties());
        RequestRateLimiterGatewayFilterFactory rateFactory = new RequestRateLimiterGatewayFilterFactory(
                mock(RateLimiter.class), mock(KeyResolver.class));
        SpringCloudCircuitBreakerFilterFactory circuitFactory = mock(SpringCloudCircuitBreakerFilterFactory.class);
        GatewayFilter noop = (exchange, chain) -> chain.filter(exchange);
        when(circuitFactory.apply(any(SpringCloudCircuitBreakerFilterFactory.Config.class))).thenReturn(noop);
        when(context.getBean(PathRoutePredicateFactory.class)).thenReturn(pathFactory);
        when(context.getBean(RequestRateLimiterGatewayFilterFactory.class)).thenReturn(rateFactory);
        when(context.getBean(SpringCloudCircuitBreakerFilterFactory.class)).thenReturn(circuitFactory);
        when(context.getBean(StripPrefixGatewayFilterFactory.class)).thenReturn(new StripPrefixGatewayFilterFactory());
        when(context.getBean(AddRequestHeaderGatewayFilterFactory.class)).thenReturn(new AddRequestHeaderGatewayFilterFactory());
        when(context.getBean(DedupeResponseHeaderGatewayFilterFactory.class)).thenReturn(new DedupeResponseHeaderGatewayFilterFactory());
        when(context.getBean(PreserveHostHeaderGatewayFilterFactory.class)).thenReturn(new PreserveHostHeaderGatewayFilterFactory());

        RouteConfig config = new RouteConfig(
                "http://product", "http://user", "http://search", "http://inventory", "http://cart",
                "http://order", "http://payment", "http://shipping", "http://notification",
                 "http://finance", "http://recommendations", "http://messaging", "http://monitoring", "http://configuration", "http://coupon", "http://keycloak", "http://minio", "internal-secret",
                 PublicBucketProperties.defaults());
        TieredRateLimiter limiter = new TieredRateLimiter(mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class),
                mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class));
        RouteLocator locator = config.gatewayRoutes(new RouteLocatorBuilder(context), limiter, limiter, limiter, limiter,
                limiter, limiter, limiter, limiter, mock(KeyResolver.class));

        List<Route> routes = locator.getRoutes().collectList().block();

        assertThat(routes).isNotNull().extracting(Route::getId)
                .contains("products", "videos", "search", "flash-sale-reserve", "flash-sale-stock", "flash-sale-active",
                 "recommendations", "monitoring", "configuration", "configuration-reload");
        assertThat(route(routes, "keycloak-oidc").getUri()).isEqualTo(URI.create("http://keycloak:80"));
        assertThat(matches(route(routes, "keycloak-oidc"), "/realms/vnshop/protocol/openid-connect/auth")).isTrue();
        assertThat(matches(route(routes, "keycloak-oidc"), "/admin/master/console/")).isFalse();
        assertThat(route(routes, "products").getUri()).isEqualTo(URI.create("http://product:80"));
        assertThat(route(routes, "videos").getUri()).isEqualTo(URI.create("http://product:80"));
        assertThat(matches(route(routes, "videos"), "/videos/upload/00000000-0000-0000-0000-000000000001")).isTrue();
        assertThat(route(routes, "search").getUri()).isEqualTo(URI.create("http://search:80"));
        assertThat(route(routes, "flash-sale-reserve").getUri()).isEqualTo(URI.create("http://inventory:80"));
        assertThat(route(routes, "recommendations").getUri()).isEqualTo(URI.create("http://recommendations:80"));
        assertThat(route(routes, "shipping-webhooks").getUri()).isEqualTo(URI.create("http://shipping:80"));
        assertThat(matches(route(routes, "products"), "/products/v2")).isTrue();
        assertThat(matches(route(routes, "search"), "/search/v2")).isTrue();
        assertThat(matches(route(routes, "flash-sale-reserve"), "/flash-sale/reserve")).isTrue();
        assertThat(matches(route(routes, "flash-sale-stock"), "/flash-sale/stock/p1")).isTrue();
        assertThat(matches(route(routes, "monitoring"), "/monitoring/openapi.json")).isTrue();
        assertThat(matches(route(routes, "monitoring"), "/monitoring/docs")).isTrue();
        assertThat(matches(route(routes, "monitoring-ws"), "/monitoring/socket.io/?EIO=4&transport=websocket")).isTrue();
        assertThat(matches(route(routes, "configuration"), "/api/config")).isTrue();
        assertThat(matches(route(routes, "configuration"), "/api/config/public")).isTrue();
        assertThat(matches(route(routes, "configuration"), "/api/config/services")).isFalse();
        assertThat(route(routes, "configuration-reload").getUri()).isEqualTo(URI.create("http://configuration:80"));
        assertThat(matches(route(routes, "configuration-reload"), "/api/config/reload")).isTrue();
        assertThat(matches(route(routes, "shipping-webhooks"), "/webhooks/ghn")).isTrue();
        assertThat(matches(route(routes, "shipping-webhooks"), "/webhooks/ghtk")).isTrue();
        assertThat(matches(route(routes, "shipping-webhooks"), "/webhooks/unknown")).isFalse();
        assertThat(route(routes, "notifications-ws").getUri()).isEqualTo(URI.create("http://notification:80"));
        assertThat(matches(route(routes, "notifications-ws"), "/ws/notifications/")).isTrue();
        assertThat(matches(route(routes, "notifications-ws"), "/ws/messaging")).isFalse();
        assertThat(route(routes, "checkout").getUri()).isEqualTo(URI.create("http://order:80"));
        assertThat(route(routes, "checkout-coupons").getUri()).isEqualTo(URI.create("http://coupon:80"));
        assertThat(matches(route(routes, "checkout-coupons"), "/checkout/apply-coupon")).isTrue();
        assertThat(matches(route(routes, "checkout-coupons"), "/checkout/validate-coupon")).isTrue();
        assertThat(matches(route(routes, "checkout"), "/checkout/payment-methods")).isTrue();
        assertThat(route(routes, "coupons").getUri()).isEqualTo(URI.create("http://coupon:80"));
        assertThat(matches(route(routes, "coupons"), "/coupons/validate")).isTrue();
        assertThat(route(routes, "admin-coupons").getUri()).isEqualTo(URI.create("http://coupon:80"));
    }

    @Test
    void minioRouteOnlyMatchesApprovedPublicBuckets() {
        ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
        PathRoutePredicateFactory pathFactory = new PathRoutePredicateFactory(new WebFluxProperties());
        when(context.getBean(PathRoutePredicateFactory.class)).thenReturn(pathFactory);
        when(context.getBean(StripPrefixGatewayFilterFactory.class)).thenReturn(new StripPrefixGatewayFilterFactory());
        when(context.getBean(AddRequestHeaderGatewayFilterFactory.class)).thenReturn(new AddRequestHeaderGatewayFilterFactory());
        when(context.getBean(DedupeResponseHeaderGatewayFilterFactory.class)).thenReturn(new DedupeResponseHeaderGatewayFilterFactory());
        when(context.getBean(PreserveHostHeaderGatewayFilterFactory.class)).thenReturn(new PreserveHostHeaderGatewayFilterFactory());
        when(context.getBean(RequestRateLimiterGatewayFilterFactory.class)).thenReturn(
                new RequestRateLimiterGatewayFilterFactory(mock(RateLimiter.class), mock(KeyResolver.class)));
        SpringCloudCircuitBreakerFilterFactory circuitFactory = mock(SpringCloudCircuitBreakerFilterFactory.class);
        GatewayFilter noop = (exchange, chain) -> chain.filter(exchange);
        when(circuitFactory.apply(any(SpringCloudCircuitBreakerFilterFactory.Config.class))).thenReturn(noop);
        when(circuitFactory.apply(any(String.class), any(Consumer.class))).thenReturn(noop);
        when(context.getBean(SpringCloudCircuitBreakerFilterFactory.class)).thenReturn(circuitFactory);
        RouteConfig config = new RouteConfig("http://product", "http://user", "http://search", "http://inventory", "http://cart",
                "http://order", "http://payment", "http://shipping", "http://notification", "http://finance", "http://recommendations",
                 "http://messaging", "http://monitoring", "http://configuration", "http://coupon", "http://keycloak", "http://minio", "secret",
                 PublicBucketProperties.defaults());
        TieredRateLimiter limiter = new TieredRateLimiter(mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class),
                mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class));
        List<Route> routes = config.gatewayRoutes(new RouteLocatorBuilder(context), limiter, limiter, limiter, limiter, limiter, limiter, limiter, limiter,
                mock(KeyResolver.class)).getRoutes().collectList().block();
        Route minio = route(routes, "minio-public");
        assertThat(minio.getUri()).isEqualTo(URI.create("http://minio:80"));
        assertThat(minio.getFilters()).anyMatch(filter -> filter.toString().contains("PreserveHostHeader"));
        assertThat(minio.getFilters()).anyMatch(filter -> filter.toString().contains("DedupeResponseHeader"));
        assertThat(minio.getFilters()).anyMatch(filter -> filter.toString().contains(
                "Access-Control-Allow-Credentials Access-Control-Allow-Origin"));
        for (String bucket : List.of("vnshop-avatars", "vnshop-products", "vnshop-reviews", "vnshop-videos")) {
            assertThat(matches(minio, "/" + bucket + "/nested/object.jpg")).isTrue();
        }
        for (String path : List.of("/invoices/a.pdf", "/vnshop-videos-staging/a.mp4", "/admin/console", "/health/ready")) {
            assertThat(matches(minio, path)).isFalse();
        }
    }

    @Test
    void minioRouteUsesExactlyConfiguredPublicBucketNames() {
        ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
        PathRoutePredicateFactory pathFactory = new PathRoutePredicateFactory(new WebFluxProperties());
        when(context.getBean(PathRoutePredicateFactory.class)).thenReturn(pathFactory);
        when(context.getBean(StripPrefixGatewayFilterFactory.class)).thenReturn(new StripPrefixGatewayFilterFactory());
        when(context.getBean(AddRequestHeaderGatewayFilterFactory.class)).thenReturn(new AddRequestHeaderGatewayFilterFactory());
        when(context.getBean(DedupeResponseHeaderGatewayFilterFactory.class)).thenReturn(new DedupeResponseHeaderGatewayFilterFactory());
        when(context.getBean(PreserveHostHeaderGatewayFilterFactory.class)).thenReturn(new PreserveHostHeaderGatewayFilterFactory());
        when(context.getBean(RequestRateLimiterGatewayFilterFactory.class)).thenReturn(
                new RequestRateLimiterGatewayFilterFactory(mock(RateLimiter.class), mock(KeyResolver.class)));
        SpringCloudCircuitBreakerFilterFactory circuitFactory = mock(SpringCloudCircuitBreakerFilterFactory.class);
        GatewayFilter noop = (exchange, chain) -> chain.filter(exchange);
        when(circuitFactory.apply(any(SpringCloudCircuitBreakerFilterFactory.Config.class))).thenReturn(noop);
        when(circuitFactory.apply(any(String.class), any(Consumer.class))).thenReturn(noop);
        when(context.getBean(SpringCloudCircuitBreakerFilterFactory.class)).thenReturn(circuitFactory);
        PublicBucketProperties buckets = new PublicBucketProperties("avatars-custom", "products-custom", "reviews-custom", "videos-custom");
        RouteConfig config = new RouteConfig("http://product", "http://user", "http://search", "http://inventory", "http://cart",
                "http://order", "http://payment", "http://shipping", "http://notification", "http://finance", "http://recommendations",
                "http://messaging", "http://monitoring", "http://configuration", "http://coupon", "http://keycloak", "http://minio", "secret", buckets);
        TieredRateLimiter limiter = new TieredRateLimiter(mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class),
                mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class));

        List<Route> routes = config.gatewayRoutes(new RouteLocatorBuilder(context), limiter, limiter, limiter, limiter, limiter, limiter, limiter, limiter,
                mock(KeyResolver.class)).getRoutes().collectList().block();
        Route minio = route(routes, "minio-public");

        assertThat(matches(minio, "/avatars-custom/a.jpg")).isTrue();
        assertThat(matches(minio, "/products-custom/p.jpg")).isTrue();
        assertThat(matches(minio, "/reviews-custom/r.jpg")).isTrue();
        assertThat(matches(minio, "/videos-custom/v.mp4")).isTrue();
        assertThat(matches(minio, "/vnshop-avatars/a.jpg")).isFalse();
        assertThat(matches(minio, "/videos-custom-staging/v.mp4")).isFalse();
    }

    @Test
    void publicBucketConfigurationRejectsUnsafeSegments() {
        for (String invalid : List.of("bucket/name", "bucket\\\\name", "bucket*name", "bucket?name", "bucket#name", ".", "..", "bucket..name", "Bucket")) {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> new PublicBucketProperties(invalid, "products", "reviews", "videos"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    private static Route route(List<Route> routes, String id) {
        return routes.stream().filter(route -> route.getId().equals(id)).findFirst().orElseThrow();
    }

    private static boolean matches(Route route, String path) {
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(path).build());
        return Boolean.TRUE.equals(Mono.from(route.getPredicate().apply(exchange)).block());
    }
}
