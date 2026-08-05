package com.vnshop.paymentservice.infrastructure.config;

import com.vnshop.paymentservice.infrastructure.gateway.MomoProperties;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayProperties;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalProperties;
import com.vnshop.paymentservice.infrastructure.sepay.SepayProperties;
import com.vnshop.paymentservice.infrastructure.stripe.StripeProperties;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

/**
 * Tests for {@link PaymentMethodValidator}.
 *
 * Uses reflection to set private fields since @SpringBootTest with mocked beans
 * would require a full application context for every variant. This approach lets us
 * test each validation scenario in isolation without Testcontainers.
 */
class PaymentMethodValidatorTest {

    private PaymentMethodValidator validator(
            boolean codEnabled,
            boolean vietqrEnabled, String vietqrAccountNo, String vietqrAccountName,
            boolean vnpayEnabled, VnpayProperties vnpayProperties,
            boolean momoEnabled, MomoProperties momoProperties,
            StripeProperties stripeProperties,
            PayPalProperties payPalProperties,
            SepayProperties sepayProperties,
            String publicApiUrl, String frontendUrl) {

        PaymentMethodValidator v = new PaymentMethodValidator(
                stripeProperties, payPalProperties, vnpayProperties, momoProperties, sepayProperties);
        ReflectionTestUtils.setField(v, "codEnabled", codEnabled);
        ReflectionTestUtils.setField(v, "vietqrEnabled", vietqrEnabled);
        ReflectionTestUtils.setField(v, "vietqrAccountNo", vietqrAccountNo);
        ReflectionTestUtils.setField(v, "vietqrAccountName", vietqrAccountName);
        ReflectionTestUtils.setField(v, "vnpayEnabled", vnpayEnabled);
        ReflectionTestUtils.setField(v, "momoEnabled", momoEnabled);
        ReflectionTestUtils.setField(v, "publicApiUrl", publicApiUrl);
        ReflectionTestUtils.setField(v, "frontendUrl", frontendUrl);
        return v;
    }

    @Test
    void cod_only_is_valid() {
        assertThatCode(() -> validator(
                true,
                false, null, null,
                false, vnpay(false),
                false, momo(false),
                stripe(false), paypal(false), sepay(false),
                null, null
        ).validate()).doesNotThrowAnyException();
    }

    @Test
    void all_disabled_is_valid() {
        assertThatCode(() -> validator(
                false,
                false, null, null,
                false, vnpay(false),
                false, momo(false),
                stripe(false), paypal(false), sepay(false),
                null, null
        ).validate()).doesNotThrowAnyException();
    }

    @Test
    void vietqr_requires_accountNo_and_accountName_when_enabled() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        true, "", null,
                        false, vnpay(false),
                        false, momo(false),
                        stripe(false), paypal(false), sepay(false),
                        null, null
                ).validate())
                .withMessageContaining("VIETQR_ACCOUNT_NO")
                .withMessageContaining("VIETQR_ACCOUNT_NAME");

        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        true, "123456789", "",
                        false, vnpay(false),
                        false, momo(false),
                        stripe(false), paypal(false), sepay(false),
                        null, null
                ).validate())
                .withMessageContaining("VIETQR_ACCOUNT_NAME");
    }

    @Test
    void vietqr_withBothCredentials_isValid() {
        assertThatCode(() -> validator(
                false,
                true, "123456789", "Test Account",
                false, vnpay(false),
                false, momo(false),
                stripe(false), paypal(false), sepay(false),
                null, null
        ).validate()).doesNotThrowAnyException();
    }

    @Test
    void vnpay_requires_tmnCode_and_hashSecret() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        false, null, null,
                        true, vnpay(true, "", ""),
                        false, momo(false),
                        stripe(false), paypal(false), sepay(false),
                        "https://api.test", "https://shop.test"
                ).validate())
                .withMessageContaining("VNPAY_TMN_CODE")
                .withMessageContaining("VNPAY_HASH_SECRET");
    }

    @Test
    void vnpay_requires_publicApiUrl_and_frontendUrl_for_callbacks() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        false, null, null,
                        true, vnpay(true, "TMN", "SECRET"),
                        false, momo(false),
                        stripe(false), paypal(false), sepay(false),
                        "", "https://shop.test"
                ).validate())
                .withMessageContaining("VNSHOP_PUBLIC_API_URL");
    }

    @Test
    void momo_requires_partnerCode_accessKey_and_secretKey() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        false, null, null,
                        false, vnpay(false),
                        true, momo(true, "", "", ""),
                        stripe(false), paypal(false), sepay(false),
                        "https://api.test", "https://shop.test"
                ).validate())
                .withMessageContaining("MOMO_PARTNER_CODE")
                .withMessageContaining("MOMO_ACCESS_KEY")
                .withMessageContaining("MOMO_SECRET_KEY");
    }

    @Test
    void stripe_requires_allThree_credentials() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        false, null, null,
                        false, vnpay(false),
                        false, momo(false),
                        stripe(true, "", ""),
                        paypal(false), sepay(false),
                        null, null
                ).validate())
                .withMessageContaining("STRIPE_SECRET_KEY")
                .withMessageContaining("STRIPE_WEBHOOK_SECRET");
    }

    @Test
    void paypal_requires_clientId_and_clientSecret() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        false, null, null,
                        false, vnpay(false),
                        false, momo(false),
                        stripe(false), paypal(true, "", ""),
                        sepay(false),
                        null, null
                ).validate())
                .withMessageContaining("PAYPAL_CLIENT_ID")
                .withMessageContaining("PAYPAL_CLIENT_SECRET");
    }

    @Test
    void sepay_requires_apiKey_and_accountId() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        false, null, null,
                        false, vnpay(false),
                        false, momo(false),
                        stripe(false), paypal(false),
                        sepay(true, "", ""),
                        null, null
                ).validate())
                .withMessageContaining("SEPAY_API_KEY")
                .withMessageContaining("SEPAY_ACCOUNT_ID");
    }

    @Test
    void multipleMissingCredentials_allReportedTogether() {
        assertThatIllegalStateException()
                .isThrownBy(() -> validator(
                        false,
                        true, "", "",
                        true, vnpay(true, "", ""),
                        true, momo(true, "", "", ""),
                        stripe(true, "", ""),
                        paypal(true, "", ""),
                        sepay(true, "", ""),
                        "", ""
                ).validate())
                .withMessageContaining("VIETQR")
                .withMessageContaining("VNPAY")
                .withMessageContaining("MOMO")
                .withMessageContaining("STRIPE")
                .withMessageContaining("PAYPAL")
                .withMessageContaining("SEPAY");
    }

    @Test
    void all_methods_withValidCredentials_isValid() {
        assertThatCode(() -> validator(
                true,
                true, "123456789", "Test Account",
                true, vnpay(true, "TMN", "SECRET"),
                true, momo(true, "PARTNER", "ACCESS", "SECRET"),
                stripe(true, "sk_test", "whsec_test"),
                paypal(true, "client_id", "client_secret"),
                sepay(true, "api_key", "account_id"),
                "https://api.test", "https://shop.test"
        ).validate()).doesNotThrowAnyException();
    }

    private static VnpayProperties vnpay(boolean enabled) {
        return vnpay(enabled, "TMNCODE", "HASHSECRET");
    }

    private static VnpayProperties vnpay(boolean enabled, String tmnCode, String hashSecret) {
        VnpayProperties p = new VnpayProperties(
                "https://sandbox.vnpayment.vn",
                tmnCode,
                hashSecret,
                "https://shop.test/payment/vnpay/return",
                "https://api.test/payment/vnpay/ipn",
                "2.1.0", "pay", "other", "vn", "VND", 15);
        return p;
    }

    private static MomoProperties momo(boolean enabled) {
        return momo(enabled, "PARTNER", "ACCESS", "SECRET");
    }

    private static MomoProperties momo(boolean enabled, String partnerCode, String accessKey, String secretKey) {
        MomoProperties p = new MomoProperties(
                "https://test.momo.vn",
                "https://test.momo.vn/query",
                partnerCode,
                accessKey,
                secretKey,
                "https://shop.test/payment/momo/return",
                "https://api.test/payment/momo/ipn",
                "captureWallet", "vi");
        return p;
    }

    private static StripeProperties stripe(boolean enabled) {
        return stripe(enabled, "sk_test", "whsec_test");
    }

    private static StripeProperties stripe(boolean enabled, String secretKey, String webhookSecret) {
        return new StripeProperties(enabled, secretKey, "pk_test", webhookSecret);
    }

    private static PayPalProperties paypal(boolean enabled) {
        return paypal(enabled, "client_id", "client_secret");
    }

    private static PayPalProperties paypal(boolean enabled, String clientId, String clientSecret) {
        return new PayPalProperties(enabled, clientId, clientSecret, "sandbox");
    }

    private static SepayProperties sepay(boolean enabled) {
        return sepay(enabled, "api_key", "account_id");
    }

    private static SepayProperties sepay(boolean enabled, String apiKey, String accountId) {
        return new SepayProperties(enabled, apiKey, accountId, "https://api.sepay.vn", 60, "sepay_webhook_secret");
    }
}
