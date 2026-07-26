package com.vnshop.userservice;

import com.vnshop.userservice.domain.port.out.GdprExportRepositoryPort;
import com.vnshop.userservice.domain.port.out.SellerStatsPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import com.vnshop.userservice.domain.port.out.WishlistRepositoryPort;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
		// resilience4j-spring-boot3's SpringBoot3Verifier bean hard-fails on Spring Boot 4
		// (we're on Spring Boot 4.1.0). Excluding the verifier autoconfig keeps the rest of
		// the circuit-breaker wiring intact for production use.
		"spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration,org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration,io.github.resilience4j.springboot3.verifier.autoconfigure.SpringBoot3VerifierAutoConfiguration"
})
class UserServiceApplicationTests {

	@MockitoBean
	private UserRepositoryPort userRepositoryPort;

	@MockitoBean
	private WishlistRepositoryPort wishlistRepositoryPort;

	@MockitoBean
	private SellerStatsPort sellerStatsPort;

	@MockitoBean
	private GdprExportRepositoryPort gdprExportRepositoryPort;

	@MockitoBean
	@SuppressWarnings("rawtypes")
	private KafkaTemplate kafkaTemplate;

	// Replace the auto-configured JwtDecoder (which would otherwise probe the
	// real Keycloak issuer-uri) with a Mockito stub so context-load passes.
	@MockitoBean
	private JwtDecoder jwtDecoder;

	@Autowired
	private FilterChainProxy filterChainProxy;

	@Test
	void contextLoads() {
	}

	@Test
	void refreshUsesCookieAuthChainBeforeBearerChain() {
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/refresh");
		var chains = filterChainProxy.getFilterChains();

		assertThat(chains).hasSizeGreaterThanOrEqualTo(2);
		assertThat(chains.get(0).matches(request)).isTrue();
		assertThat(chains.get(0).getFilters())
				.noneMatch(filter -> filter.getClass().getSimpleName().contains("BearerToken"));
	}

}
