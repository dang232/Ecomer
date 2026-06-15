package com.vnshop.productservice;

import com.vnshop.productservice.application.video.VideoAdminService;
import com.vnshop.productservice.application.video.VideoUploadService;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=" +
        "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration," +
        "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration," +
        "org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration," +
        "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration," +
        "org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration," +
        "org.springframework.boot.data.redis.autoconfigure.RedisAutoConfiguration",
        "spring.data.jpa.repositories.enabled=false"
})
class ProductServiceApplicationTests {

    @MockitoBean
    private KafkaTemplate<String, ProductEvent> kafkaTemplate;

    @MockitoBean
    private ObjectMetadataRepositoryPort objectMetadataRepositoryPort;

    @MockitoBean
    private ObjectStoragePort objectStoragePort;

    @MockitoBean
    private ProductRepositoryPort productRepositoryPort;

    @MockitoBean
    private ReviewRepositoryPort reviewRepositoryPort;

    // The real adapter wires up an HTTP client + ObjectMapper, neither of
    // which we need (or have) in the slimmed test context. Mocking the
    // port keeps the bean-graph happy without booting Jackson autoconfig.
    @MockitoBean
    private BuyerProfileLookupPort buyerProfileLookupPort;

    // Video ports - mocked at port level to avoid JPA/Redis wiring.
    @MockitoBean
    private VideoRepositoryPort videoRepositoryPort;

    @MockitoBean
    private VideoEventPublisherPort videoEventPublisherPort;

    // Mock the services directly so UseCaseConfig bean graph resolves cleanly.
    @MockitoBean
    private VideoAdminService videoAdminService;

    @MockitoBean
    private VideoUploadService videoUploadService;

    @Test
    void contextLoads() {
    }

}
