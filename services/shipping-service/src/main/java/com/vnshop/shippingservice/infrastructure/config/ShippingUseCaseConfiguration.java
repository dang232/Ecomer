package com.vnshop.shippingservice.infrastructure.config;

import com.vnshop.shippingservice.application.CreateLabelUseCase;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.domain.port.out.CarrierLabelPolicyPort;
import com.vnshop.shippingservice.domain.port.out.CodCollectionEvidencePort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class ShippingUseCaseConfiguration {
    @Bean
    CarrierLabelPolicyPort carrierLabelPolicyPort(CarrierProperties carrierProperties, Environment environment) {
        return new CarrierLabelPolicyAdapter(carrierProperties, environment);
    }

    @Bean
    CreateLabelUseCase createLabelUseCase(
            CarrierGatewayPort carrierGateway,
            CarrierLabelPolicyPort carrierLabelPolicyPort,
            CodCollectionEvidencePort codCollectionEvidencePort) {
        return new CreateLabelUseCase(carrierGateway, carrierLabelPolicyPort, codCollectionEvidencePort);
    }
}
