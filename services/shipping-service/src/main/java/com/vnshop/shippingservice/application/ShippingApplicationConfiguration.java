package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.infrastructure.config.CarrierProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class ShippingApplicationConfiguration {
    @Bean
    ShippingRateCalculator shippingRateCalculator(CarrierGatewayPort carrierGateway) {
        return new ShippingRateCalculator(carrierGateway);
    }

    @Bean
    GetTrackingUseCase getTrackingUseCase(CarrierGatewayPort carrierGateway) {
        return new GetTrackingUseCase(carrierGateway);
    }

    @Bean
    QuoteShippingOptionsUseCase quoteShippingOptionsUseCase(CarrierGatewayPort carrierGateway) {
        return new QuoteShippingOptionsUseCase(carrierGateway);
    }

    @Bean
    CreateLabelUseCase createLabelUseCase(
            CarrierGatewayPort carrierGateway,
            CarrierProperties carrierProperties,
            Environment environment) {
        return new CreateLabelUseCase(carrierGateway, carrierProperties, environment);
    }
}
