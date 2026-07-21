package com.vnshop.shippingservice.infrastructure.config;

import com.vnshop.shippingservice.domain.port.out.CarrierLabelPolicyPort;
import org.springframework.core.env.Environment;

import java.util.Objects;

/** Resolves whether the explicitly local stub boundary is active. */
public final class CarrierLabelPolicyAdapter implements CarrierLabelPolicyPort {
    private final CarrierProperties carrierProperties;
    private final Environment environment;

    public CarrierLabelPolicyAdapter(CarrierProperties carrierProperties, Environment environment) {
        this.carrierProperties = Objects.requireNonNull(carrierProperties, "carrierProperties is required");
        this.environment = Objects.requireNonNull(environment, "environment is required");
    }

    @Override
    public boolean allowsIncompleteLabelData() {
        return "stub".equalsIgnoreCase(carrierProperties.mode())
                && environment.matchesProfiles("local", "dev");
    }
}
