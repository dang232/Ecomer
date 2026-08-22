package com.vnshop.paymentservice.infrastructure.paypal;

public record PayPalWebhookHeaders(
        String authAlgo,
        String certUrl,
        String transmissionId,
        String transmissionSig,
        String transmissionTime) {

    public boolean complete() {
        return notBlank(authAlgo) && notBlank(certUrl) && notBlank(transmissionId)
                && notBlank(transmissionSig) && notBlank(transmissionTime);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
