package com.vnshop.shippingservice.infrastructure.config;

import com.vnshop.shippingservice.application.CreateLabelUseCase;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.domain.port.out.CarrierLabelPolicyPort;
import com.vnshop.shippingservice.domain.port.out.CodCollectionEvidencePort;
import com.vnshop.shippingservice.domain.port.out.ShippingLabelRepositoryPort;
import com.vnshop.shippingservice.infrastructure.persistence.ShippingLabelJdbcAdapter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class ShippingUseCaseConfiguration {
    @Bean
    ShippingLabelRepositoryPort shippingLabelRepositoryPort(ObjectProvider<JdbcTemplate> jdbcTemplateProvider) {
        JdbcTemplate jdbcTemplate = jdbcTemplateProvider.getIfAvailable();
        return jdbcTemplate == null
                ? ShippingLabelRepositoryPort.noop()
                : new ShippingLabelJdbcAdapter(jdbcTemplate);
    }

    @Bean
    CarrierLabelPolicyPort carrierLabelPolicyPort(CarrierProperties carrierProperties, Environment environment) {
        return new CarrierLabelPolicyAdapter(carrierProperties, environment);
    }

    @Bean
    CreateLabelUseCase createLabelUseCase(
            CarrierGatewayPort carrierGateway,
            CarrierLabelPolicyPort carrierLabelPolicyPort,
            CodCollectionEvidencePort codCollectionEvidencePort,
            ObjectProvider<ShippingLabelRepositoryPort> shippingLabelRepositoryProvider) {
        ShippingLabelRepositoryPort shippingLabelRepositoryPort = shippingLabelRepositoryProvider
                .getIfAvailable(ShippingLabelRepositoryPort::noop);
        return new CreateLabelUseCase(carrierGateway, carrierLabelPolicyPort, codCollectionEvidencePort,
                shippingLabelRepositoryPort);
    }
}
