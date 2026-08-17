package com.vnshop.shippingservice;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.core.KafkaTemplate;

import com.vnshop.shippingservice.infrastructure.carrier.CarrierHttpClient;

@SpringBootTest(properties = {
		"spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration",
		"grpc.server.enabled=false",
		"management.endpoint.health.group.readiness.include=readinessState,ping"
})
class ShippingServiceApplicationTests {

	@TestConfiguration
	static class InfrastructureMockConfig {
		@Bean
		@SuppressWarnings("unchecked")
		KafkaTemplate<String, String> kafkaTemplate() {
			return Mockito.mock(KafkaTemplate.class);
		}

		@Bean
		CarrierHttpClient carrierHttpClient() {
			return Mockito.mock(CarrierHttpClient.class);
		}
	}

	@Test
	void contextLoads() {
	}

}
