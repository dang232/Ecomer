package com.vnshop.shippingservice.domain.port.out;

/** Supplies carrier execution policy without coupling application code to Spring configuration. */
public interface CarrierLabelPolicyPort {
    boolean allowsIncompleteLabelData();
}
