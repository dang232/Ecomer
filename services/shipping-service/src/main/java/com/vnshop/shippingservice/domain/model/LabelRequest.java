package com.vnshop.shippingservice.domain.model;

public record LabelRequest(
        CarrierCode carrier,
        String orderId,
        ShippingAddress fromAddress,
        ShippingAddress toAddress,
        Parcel parcel,
        long codAmountVnd,
        long declaredValueVnd,
        String itemDescription) {

    public LabelRequest(CarrierCode carrier, String orderId, ShippingAddress fromAddress,
                        ShippingAddress toAddress, Parcel parcel, long codAmountVnd,
                        String itemDescription) {
        this(carrier, orderId, fromAddress, toAddress, parcel, codAmountVnd, codAmountVnd, itemDescription);
    }
}
