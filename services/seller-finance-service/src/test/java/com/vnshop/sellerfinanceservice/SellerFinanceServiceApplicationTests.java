package com.vnshop.sellerfinanceservice;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedOrderEventRepository;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedRefundRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration",
        "vnshop.admin-cursor.secret=test-secret"
})
class SellerFinanceServiceApplicationTests {

	@MockitoBean
	private SellerWalletRepositoryPort sellerWalletRepositoryPort;

	@MockitoBean
	private PayoutRepositoryPort payoutRepositoryPort;

	@MockitoBean
	private ProcessedRefundRepository processedRefundRepository;

	@MockitoBean
	private ProcessedOrderEventRepository processedOrderEventRepository;

	@MockitoBean
	private ObjectMapper objectMapper;

	// Replace the auto-configured JwtDecoder (which would otherwise probe the
	// real Keycloak issuer-uri during SecurityConfig wiring) with a Mockito
	// stub so context-load passes without a live Keycloak instance.
	@MockitoBean
	private JwtDecoder jwtDecoder;

	@Test
	void contextLoads() {
	}

}
