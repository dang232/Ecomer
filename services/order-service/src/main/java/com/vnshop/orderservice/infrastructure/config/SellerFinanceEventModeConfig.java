package com.vnshop.orderservice.infrastructure.config;

import com.vnshop.orderservice.domain.finance.eventmode.SellerFinanceEventModePolicy;
import com.vnshop.orderservice.domain.finance.eventmode.SellerFinanceEventMode;
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
@EnableConfigurationProperties(SellerFinanceEventModeProperties.class)
public class SellerFinanceEventModeConfig {

    @Bean
    public SellerFinanceEventModePolicy sellerFinanceEventModePolicy(
            SellerFinanceEventModeProperties properties) {
        return SellerFinanceEventModePolicy.fromMode(
                SellerFinanceEventMode.parse(properties.eventMode()),
                properties.adjustments().enabled(),
                properties.adjustmentConsumer().enabled(),
                properties.legacyOrderCreatedConsumer().enabled());
    }
}
