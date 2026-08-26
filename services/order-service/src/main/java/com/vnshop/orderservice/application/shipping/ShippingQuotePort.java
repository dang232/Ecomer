package com.vnshop.orderservice.application.shipping;

/**
 * Outbound port for shipping-service /shipping/rate-quotes. The order-service
 * checkout flow asks for buyer-facing shipping options based on a destination
 * address and trusted parcel metadata; the adapter side wraps that in an HTTP
 * call.
 */
public interface ShippingQuotePort {
    ShippingQuoteResult quote(ShippingQuoteRequest request);
}
