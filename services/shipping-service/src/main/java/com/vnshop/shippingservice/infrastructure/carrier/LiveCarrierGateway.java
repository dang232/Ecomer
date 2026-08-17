package com.vnshop.shippingservice.infrastructure.carrier;

import com.vnshop.shippingservice.domain.model.CarrierCode;
import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.model.TrackingInfo;
import com.vnshop.shippingservice.domain.model.TrackingRequest;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
@RequiredArgsConstructor
@ConditionalOnProperty(name = "shipping.carrier.mode", havingValue = "live")
public class LiveCarrierGateway implements CarrierGatewayPort {
    private final GhnCarrierGateway ghnCarrierGateway;
    private final GhtkCarrierGateway ghtkCarrierGateway;

    @Override
    public RateQuote quote(RateQuoteRequest request) {
        return gatewayFor(request.carrier()).quote(request);
    }

    @Override
    public ShippingLabel createLabel(LabelRequest request) {
        return gatewayFor(request.carrier()).createLabel(request);
    }

    @Override
    public void cancelLabel(CarrierCode carrier, String trackingCode) {
        gatewayFor(carrier).cancelLabel(carrier, trackingCode);
    }

    @Override
    public TrackingInfo track(TrackingRequest request) {
        return gatewayFor(request.carrier()).track(request);
    }

    private CarrierGatewayAdapter gatewayFor(CarrierCode carrier) {
        return switch (carrier) {
            case GHN -> ghnCarrierGateway;
            case GHTK -> ghtkCarrierGateway;
        };
    }
}
