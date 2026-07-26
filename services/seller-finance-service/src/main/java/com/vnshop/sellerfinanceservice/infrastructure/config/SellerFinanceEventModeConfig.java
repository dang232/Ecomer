package com.vnshop.sellerfinanceservice.infrastructure.config;

import com.vnshop.sellerfinanceservice.domain.eventmode.SellerFinanceEventModePolicy;
import com.vnshop.sellerfinanceservice.domain.eventmode.SellerFinanceEventMode;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Binds the {@code SELLER_FINANCE_EVENT_MODE} property with strict parsing
 * and validates the legacy boolean aliases. The bean factory throws when
 * the configuration is missing, unknown, or contradictory, so Spring's
 * readiness probe reports the service as down instead of silently running
 * with the wrong mode.
 */
@Configuration
@EnableConfigurationProperties(SellerFinanceProperties.class)
public class SellerFinanceEventModeConfig {

    @Bean
    public SellerFinanceEventModePolicy sellerFinanceEventModePolicy(
            SellerFinanceProperties properties) {
        return SellerFinanceEventModePolicy.fromMode(
                SellerFinanceEventMode.parse(properties.eventMode()),
                properties.adjustmentsEnabled(),
                properties.adjustmentConsumer().enabled(),
                properties.legacyOrderCreatedConsumer().enabled());
    }
}
