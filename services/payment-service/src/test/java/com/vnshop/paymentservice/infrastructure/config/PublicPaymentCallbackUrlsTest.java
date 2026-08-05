package com.vnshop.paymentservice.infrastructure.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PublicPaymentCallbackUrlsTest {

    @Test
    void accepts_public_https_origins_with_matching_provider_callbacks() {
        assertThat(PublicPaymentCallbackUrls.validate(
                "VNPay",
                "https://api.vnshop.test",
                "https://shop.vnshop.test",
                "https://shop.vnshop.test/payment/return/vnpay",
                "https://api.vnshop.test/payment/vnpay/ipn"))
                .isEmpty();
    }

    @Test
    void rejects_private_example_and_mismatched_callback_origins() {
        assertThat(PublicPaymentCallbackUrls.validate(
                "MoMo",
                "http://localhost:8080",
                "https://shop.vnshop.invalid",
                "https://other.example/payment/return/momo",
                "https://192.168.1.10/payment/momo/ipn"))
                .isNotEmpty();
    }
}
