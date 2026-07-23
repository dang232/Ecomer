package com.vnshop.shippingservice.infrastructure.config;

import com.vnshop.shippingservice.domain.CarrierCode;
import com.vnshop.shippingservice.domain.ShippingAddress;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "shipping.checkout")
public record ShippingCheckoutProperties(CarrierCode defaultCarrier, ShippingAddress origin) {
    public ShippingCheckoutProperties {
        if (defaultCarrier == null) {
            defaultCarrier = CarrierCode.GHN;
        }
    }
}
