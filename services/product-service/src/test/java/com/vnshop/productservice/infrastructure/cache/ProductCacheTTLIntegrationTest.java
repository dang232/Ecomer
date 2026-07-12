package com.vnshop.productservice.infrastructure.cache;

import com.vnshop.productservice.application.GetCategoriesUseCase;
import com.vnshop.productservice.application.video.VideoUploadService;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.CategoryRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;
import com.vnshop.productservice.infrastructure.persistence.ObjectMetadataJpaSpringDataRepository;
import com.vnshop.productservice.infrastructure.persistence.ProductJpaSpringDataRepository;
import com.vnshop.productservice.infrastructure.persistence.review.ReviewJpaSpringDataRepository;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaSpringDataRepository;
import com.vnshop.productservice.infrastructure.persistence.video.VideoStatusHistoryJpaSpringDataRepository;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test for cache TTL behavior against a real Redis instance.
 *
 * <p>Requires:
 * <ul>
 *   <li>Docker: {@code docker compose up -d redis}</li>
 *   <li>Or: Redis running on {@code localhost:6379}</li>
 *   <li>Environment variable: {@code REDIS_HOST=localhost}</li>
 * </ul>
 *
 * <p>Runs by default via Maven when the environment is configured:
 * {@code mvn test -Dtest=ProductCacheTTLIntegrationTest -DskipTests=false}
 *
 * <p>Skips automatically when Redis is not available.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.autoconfigure.exclude=" +
                "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration," +
                "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration," +
                "org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration," +
                "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration," +
                "org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration," +
                "org.springframework.boot.security.oauth2.resource.server.jwt.JwtDecoderAutoConfiguration," +
                "org.springframework.boot.data.redis.autoconfigure.RedisAutoConfiguration",
                "spring.data.jpa.repositories.enabled=false",
                // Override TTL to 2 s so tests complete in ~3 s vs 5 min.
                "spring.cache.redis.time-to-live=2s",
                "spring.cache.type=redis",
                "spring.data.redis.host=${REDIS_HOST:localhost}",
                "spring.data.redis.port=${REDIS_PORT:6379}"
        }
)
@TestPropertySource(properties = {
        "spring.cache.redis.time-to-live=2s",
        "spring.cache.type=redis"
})
@DisplayName("ProductCache TTL Integration")
@Disabled("Requires a running Redis instance on localhost:6379 — run manually with docker compose up -d redis")
class ProductCacheTTLIntegrationTest {

    private static final String CACHE_NAME = "product";
    private static final String TEST_KEY = "test-product-ttl-key";

    // Category JPA repo is @Profile("jpa") - mock it in no-JPA test context
    @MockitoBean
    private CategoryRepositoryPort categoryRepositoryPort;

    // GetCategoriesUseCase requires CategoryRepositoryPort - mock it too
    @MockitoBean
    private GetCategoriesUseCase getCategoriesUseCase;

    // Video JPA repos are @Profile("jpa") - mock them in no-JPA test context
    @MockitoBean
    private VideoJpaSpringDataRepository videoJpaSpringDataRepository;

    @MockitoBean
    private VideoStatusHistoryJpaSpringDataRepository videoStatusHistoryJpaSpringDataRepository;

    // Product JPA repos are @Profile("jpa") - mock them in no-JPA test context
    @MockitoBean
    private ProductJpaSpringDataRepository productJpaSpringDataRepository;

    @MockitoBean
    private ObjectMetadataJpaSpringDataRepository objectMetadataJpaSpringDataRepository;

    @MockitoBean
    private ReviewJpaSpringDataRepository reviewJpaSpringDataRepository;

    // VideoReaper needs VideoRepositoryPort
    @MockitoBean
    private VideoRepositoryPort videoRepositoryPort;

    // CreateProductUseCase needs ProductRepositoryPort
    @MockitoBean
    private ProductRepositoryPort productRepositoryPort;

    // ProductImageUploadService needs ObjectMetadataRepositoryPort
    @MockitoBean
    private ObjectMetadataRepositoryPort objectMetadataRepositoryPort;

    // Review-related components need ReviewRepositoryPort
    @MockitoBean
    private ReviewRepositoryPort reviewRepositoryPort;

    // ProductEventPublisher needs KafkaTemplate
    @MockitoBean
    private KafkaTemplate<String, ProductEvent> kafkaTemplate;

    // VideoEventPublisher needs KafkaTemplate
    @MockitoBean
    private KafkaTemplate<String, VideoEvent> videoKafkaTemplate;

    // VideoUploadService needs VideoJpaRepository (concrete class dependency)
    @MockitoBean
    private VideoUploadService videoUploadService;

    // SecurityConfig requires JwtDecoder
    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Autowired
    CacheManager cacheManager;

    @Test
    @DisplayName("cache entry should expire after TTL")
    void cacheEntryShouldExpireAfterTTL() throws InterruptedException {
        Cache cache = cacheManager.getCache(CACHE_NAME);

        // Put a value into the cache.
        cache.put(TEST_KEY, "test-value");

        // Immediately, the value should be retrievable.
        assertThat(cache.get(TEST_KEY)).isNotNull();
        assertThat(cache.get(TEST_KEY).get()).isEqualTo("test-value");

        // Wait for TTL (2 s) + buffer (500 ms) to pass.
        Thread.sleep(2500);

        // After expiry, the entry should be gone.
        assertThat(cache.get(TEST_KEY)).isNull();
    }

    @Test
    @DisplayName("new value cached after previous entry expires")
    void newValueCachedAfterPreviousEntryExpires() throws InterruptedException {
        Cache cache = cacheManager.getCache(CACHE_NAME);

        // Cache initial value.
        cache.put(TEST_KEY, "original");
        assertThat(cache.get(TEST_KEY).get()).isEqualTo("original");

        // Wait for TTL.
        Thread.sleep(2500);

        // Entry expired.
        assertThat(cache.get(TEST_KEY)).isNull();

        // Cache a new value — should be retrievable immediately.
        cache.put(TEST_KEY, "updated");
        assertThat(cache.get(TEST_KEY).get()).isEqualTo("updated");
    }
}
