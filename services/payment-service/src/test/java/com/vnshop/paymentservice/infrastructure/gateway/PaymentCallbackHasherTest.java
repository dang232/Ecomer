package com.vnshop.paymentservice.infrastructure.gateway;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentCallbackHasherTest {

    @Test
    void sha256_of_null_returnsSameAsEmptyString() {
        String hashNull = PaymentCallbackHasher.sha256(null);
        String hashEmpty = PaymentCallbackHasher.sha256("");
        assertThat(hashNull).isEqualTo(hashEmpty);
    }

    @Test
    void sha256_producesStable64CharHex() {
        String hash = PaymentCallbackHasher.sha256("hello world");
        assertThat(hash).hasSize(64);
        assertThat(hash).matches("^[0-9a-f]{64}$");
    }

    @Test
    void sha256_isDeterministic() {
        String first = PaymentCallbackHasher.sha256("order-123|buyer-456|120000.00|VNPAY");
        String second = PaymentCallbackHasher.sha256("order-123|buyer-456|120000.00|VNPAY");
        assertThat(first).isEqualTo(second);
    }

    @Test
    void sha256_differentInputsProduceDifferentHashes() {
        String a = PaymentCallbackHasher.sha256("order-1");
        String b = PaymentCallbackHasher.sha256("order-2");
        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void canonical_sortsKeysAlphabetically() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("z_param", "z-val");
        params.put("a_param", "a-val");
        params.put("m_param", "m-val");

        String canonical = PaymentCallbackHasher.canonical(params);

        assertThat(canonical).isEqualTo("a_param=a-val&m_param=m-val&z_param=z-val");
    }

    @Test
    void canonical_nullValuesAreReplacedWithEmptyString() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("key1", "val1");
        params.put("key2", null);
        params.put("key3", "val3");

        String canonical = PaymentCallbackHasher.canonical(params);

        assertThat(canonical).isEqualTo("key1=val1&key2=&key3=val3");
    }

    @Test
    void canonical_emptyMap_returnsEmptyString() {
        assertThat(PaymentCallbackHasher.canonical(Map.of())).isEmpty();
    }
}
