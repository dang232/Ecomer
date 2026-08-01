package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.infrastructure.gateway.MomoProperties;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayProperties;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalProperties;
import com.vnshop.paymentservice.infrastructure.sepay.SepayProperties;
import com.vnshop.paymentservice.infrastructure.stripe.StripeProperties;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link PaymentMethodsController#listMethods()}.
 *
 * Tests the response DTOs without a full Spring context. Uses reflection to set
 * the private @Value fields and constructor-injected properties.
 */
class PaymentMethodsControllerTest {

    @Test
    void codOnly_returnsCodMethod() {
        PaymentMethodsController controller = controller(
                true, false, null, null,
                false, vnpay(false), false,
                stripe(false), paypal(false), momo(false), sepay(false));

        List<PaymentMethodsController.PaymentMethodDto> methods = controller.listMethods().data();

        assertThat(methods).hasSize(1);
        assertThat(methods.get(0).id()).isEqualTo("cod");
        assertThat(methods.get(0).name()).isEqualTo("Cash on Delivery");
        assertThat(methods.get(0).enabled()).isTrue();
    }

    @Test
    void allDisabled_returnsEmptyList() {
        PaymentMethodsController controller = controller(
                false, false, null, null,
                false, vnpay(false), false,
                stripe(false), paypal(false), momo(false), sepay(false));

        assertThat(controller.listMethods().data()).isEmpty();
    }

    @Test
    void vietqr_includedOnlyWhenEnabledAndFullyConfigured() {
        // Not configured → absent
        PaymentMethodsController missingNo = controller(
                false, true, "", "",
                false, vnpay(false), false,
                stripe(false), paypal(false), momo(false), sepay(false));
        assertThat(ids(missingNo)).doesNotContain("vietqr");

        // Partially configured → absent
        PaymentMethodsController missingName = controller(
                false, true, "123456789", "   ",
                false, vnpay(false), false,
                stripe(false), paypal(false), momo(false), sepay(false));
        assertThat(ids(missingName)).doesNotContain("vietqr");

        // Fully configured → included
        PaymentMethodsController configured = controller(
                false, true, "123456789", "Test Account",
                false, vnpay(false), false,
                stripe(false), paypal(false), momo(false), sepay(false));
        assertThat(ids(configured)).contains("vietqr");
    }

    @Test
    void stripe_includedOnlyWhenFullyConfigured() {
        PaymentMethodsController missingSecret = controller(
                false, false, null, null,
                false, vnpay(false), false,
                stripe(true, "", "whsec"), paypal(false), momo(false), sepay(false));
        assertThat(ids(missingSecret)).doesNotContain("stripe");

        PaymentMethodsController configured = controller(
                false, false, null, null,
                false, vnpay(false), false,
                stripe(true, "sk_test", "whsec_test"), paypal(false), momo(false), sepay(false));
        assertThat(ids(configured)).contains("stripe");
    }

    @Test
    void paypal_includedOnlyWhenFullyConfigured() {
        PaymentMethodsController missingSecret = controller(
                false, false, null, null,
                false, vnpay(false), false,
                stripe(false), paypal(true, "id", ""), momo(false), sepay(false));
        assertThat(ids(missingSecret)).doesNotContain("paypal");

        PaymentMethodsController configured = controller(
                false, false, null, null,
                false, vnpay(false), false,
                stripe(false), paypal(true, "client_id", "secret"), momo(false), sepay(false));
        assertThat(ids(configured)).contains("paypal");
    }

    @Test
    void vnpay_includedOnlyWhenFullyConfigured() {
        PaymentMethodsController configured = controller(
                false, false, null, null,
                true, vnpay(true, "TMN", "SECRET"), false,
                stripe(false), paypal(false), momo(false), sepay(false));
        assertThat(ids(configured)).contains("vnpay");
    }

    @Test
    void momo_includedOnlyWhenFullyConfigured() {
        PaymentMethodsController missingAccess = controller(
                false, false, null, null,
                false, vnpay(false), true,
                stripe(false), paypal(false), momo(true, "PARTNER", "", "SECRET"), sepay(false));
        assertThat(ids(missingAccess)).doesNotContain("momo");

        PaymentMethodsController configured = controller(
                false, false, null, null,
                false, vnpay(false), true,
                stripe(false), paypal(false), momo(true, "PARTNER", "ACCESS", "SECRET"), sepay(false));
        assertThat(ids(configured)).contains("momo");
    }

    @Test
    void sepay_includedOnlyWhenFullyConfigured() {
        PaymentMethodsController configured = controller(
                false, false, null, null,
                false, vnpay(false), false,
                stripe(false), paypal(false), momo(false),
                sepay(true, "api_key", "account_id"));
        assertThat(ids(configured)).contains("sepay");
    }

    @Test
    void multipleMethodsReturnedInDeterministicOrder() {
        PaymentMethodsController controller = controller(
                true, true, "123456789", "Test Account",
                true, vnpay(true, "TMN", "SECRET"), true,
                stripe(true, "sk", "wh"),
                paypal(true, "id", "secret"),
                momo(true, "P", "A", "S"),
                sepay(true, "key", "id"));

        List<PaymentMethodsController.PaymentMethodDto> methods = controller.listMethods().data();

        assertThat(ids(controller)).containsExactly("cod", "vietqr", "stripe", "paypal", "vnpay", "momo", "sepay");
    }

    private static List<String> ids(PaymentMethodsController controller) {
        return controller.listMethods().data().stream()
                .map(PaymentMethodsController.PaymentMethodDto::id)
                .toList();
    }

    private static PaymentMethodsController controller(
            boolean codEnabled,
            boolean vietqrEnabled, String vietqrAccountNo, String vietqrAccountName,
            boolean vnpayEnabled, VnpayProperties vnpayProperties, boolean momoEnabled,
            StripeProperties stripeProperties, PayPalProperties payPalProperties,
            MomoProperties momoProperties, SepayProperties sepayProperties) {

        PaymentMethodsController c = new PaymentMethodsController(
                stripeProperties, payPalProperties, vnpayProperties, momoProperties, sepayProperties);
        ReflectionTestUtils.setField(c, "codEnabled", codEnabled);
        ReflectionTestUtils.setField(c, "vietqrEnabled", vietqrEnabled);
        ReflectionTestUtils.setField(c, "vietqrAccountNo", vietqrAccountNo);
        ReflectionTestUtils.setField(c, "vietqrAccountName", vietqrAccountName);
        ReflectionTestUtils.setField(c, "vnpayEnabled", vnpayEnabled);
        ReflectionTestUtils.setField(c, "momoEnabled", momoEnabled);
        return c;
    }

    private static VnpayProperties vnpay(boolean enabled) {
        return vnpay(enabled, "TMNCODE", "HASHSECRET");
    }

    private static VnpayProperties vnpay(boolean enabled, String tmn, String hash) {
        VnpayProperties p = new VnpayProperties(
                "https://sandbox.vnpayment.vn", tmn, hash,
                "https://shop.test/return", "https://api.test/ipn",
                "2.1.0", "pay", "other", "vn", "VND", 15);
        ReflectionTestUtils.setField(p, "enabled", enabled);
        return p;
    }

    private static MomoProperties momo(boolean enabled) {
        return momo(enabled, "PARTNER", "ACCESS", "SECRET");
    }

    private static MomoProperties momo(boolean enabled, String partner, String access, String secret) {
        MomoProperties p = new MomoProperties(
                "https://test.momo.vn", "https://test.momo.vn/q",
                partner, access, secret,
                "https://shop.test/return", "https://api.test/ipn",
                "captureWallet", "vi");
        ReflectionTestUtils.setField(p, "enabled", enabled);
        return p;
    }

    private static StripeProperties stripe(boolean enabled) {
        return stripe(enabled, "sk_test", "whsec_test");
    }

    private static StripeProperties stripe(boolean enabled, String sk, String wh) {
        return new StripeProperties(enabled, sk, "pk_test", wh);
    }

    private static PayPalProperties paypal(boolean enabled) {
        return paypal(enabled, "client_id", "client_secret");
    }

    private static PayPalProperties paypal(boolean enabled, String id, String secret) {
        return new PayPalProperties(enabled, id, secret, "sandbox");
    }

    private static SepayProperties sepay(boolean enabled) {
        return sepay(enabled, "api_key", "account_id");
    }

    private static SepayProperties sepay(boolean enabled, String apiKey, String accountId) {
        return new SepayProperties(enabled, apiKey, accountId, "https://api.sepay.vn", 60, "sepay_webhook_secret");
    }
}
