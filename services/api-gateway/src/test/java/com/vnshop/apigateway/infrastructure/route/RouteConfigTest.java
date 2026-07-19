package com.vnshop.apigateway.infrastructure.route;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.apigateway.infrastructure.config.TieredRateLimiter;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.webflux.autoconfigure.WebFluxProperties;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.RequestRateLimiterGatewayFilterFactory;
import org.springframework.cloud.gateway.filter.factory.SpringCloudCircuitBreakerFilterFactory;
import org.springframework.cloud.gateway.filter.factory.StripPrefixGatewayFilterFactory;
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

        RouteConfig config = new RouteConfig(
                "http://product", "http://user", "http://search", "http://inventory", "http://cart",
                "http://order", "http://payment", "http://shipping", "http://notification",
                "http://finance", "http://recommendations", "http://messaging", "http://monitoring", "http://configuration");
        TieredRateLimiter limiter = new TieredRateLimiter(mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class),
                mock(org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter.class));
        RouteLocator locator = config.gatewayRoutes(new RouteLocatorBuilder(context), limiter, limiter, limiter, limiter,
                limiter, limiter, limiter, limiter, mock(KeyResolver.class));

        List<Route> routes = locator.getRoutes().collectList().block();

        assertThat(routes).isNotNull().extracting(Route::getId)
                .contains("products", "search", "flash-sale-reserve", "flash-sale-stock", "flash-sale-active",
                        "recommendations", "monitoring", "configuration");
        assertThat(route(routes, "products").getUri()).isEqualTo(URI.create("http://product:80"));
        assertThat(route(routes, "search").getUri()).isEqualTo(URI.create("http://search:80"));
        assertThat(route(routes, "flash-sale-reserve").getUri()).isEqualTo(URI.create("http://inventory:80"));
        assertThat(route(routes, "recommendations").getUri()).isEqualTo(URI.create("http://recommendations:80"));
        assertThat(matches(route(routes, "products"), "/products/v2")).isTrue();
        assertThat(matches(route(routes, "search"), "/search/v2")).isTrue();
        assertThat(matches(route(routes, "flash-sale-reserve"), "/flash-sale/reserve")).isTrue();
        assertThat(matches(route(routes, "flash-sale-stock"), "/flash-sale/stock/p1")).isTrue();
        assertThat(matches(route(routes, "monitoring"), "/monitoring/openapi.json")).isTrue();
        assertThat(matches(route(routes, "monitoring"), "/monitoring/docs")).isTrue();
        assertThat(matches(route(routes, "configuration"), "/api/config")).isTrue();
        assertThat(matches(route(routes, "configuration"), "/api/config/public")).isTrue();
        assertThat(matches(route(routes, "configuration"), "/api/config/services")).isFalse();
        assertThat(route(routes, "checkout").getUri()).isEqualTo(URI.create("http://order:80"));
        assertThat(matches(route(routes, "checkout"), "/checkout/apply-coupon")).isTrue();
        assertThat(route(routes, "coupons").getUri()).isEqualTo(URI.create("http://order:80"));
        assertThat(matches(route(routes, "coupons"), "/coupons/validate")).isTrue();
        assertThat(route(routes, "admin-coupons").getUri()).isEqualTo(URI.create("http://order:80"));
    }

    private static Route route(List<Route> routes, String id) {
        return routes.stream().filter(route -> route.getId().equals(id)).findFirst().orElseThrow();
    }

    private static boolean matches(Route route, String path) {
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(path).build());
        return Boolean.TRUE.equals(Mono.from(route.getPredicate().apply(exchange)).block());
    }
}
