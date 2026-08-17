package com.vnshop.shippingservice.infrastructure.carrier;

import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.model.TrackingInfo;
import com.vnshop.shippingservice.domain.model.TrackingRequest;

interface CarrierGatewayAdapter {
    RateQuote quote(RateQuoteRequest request);

    ShippingLabel createLabel(LabelRequest request);

    default void cancelLabel(com.vnshop.shippingservice.domain.model.CarrierCode carrier, String trackingCode) {
        throw new UnsupportedOperationException("Carrier cancellation is not configured for " + carrier);
    }

    TrackingInfo track(TrackingRequest request);
}
