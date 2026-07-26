package com.vnshop.paymentservice.infrastructure.fx;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import org.springframework.http.MediaType;

class FrankfurterFxAdapterTest {

    @Test
    void fetchesAndCachesUsdToVndRate() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FxProperties props = new FxProperties("https://fx.example", Duration.ofHours(24), 100, new BigDecimal("25500"));
        FrankfurterFxAdapter adapter = new FrankfurterFxAdapter(props, builder);
        server.expect(requestTo("https://fx.example/latest?from=USD&to=VND"))
                .andExpect(method(GET))
                .andRespond(withSuccess("{\"rates\":{\"VND\":24875.55}}", MediaType.APPLICATION_JSON));

        BigDecimal first = adapter.rate("USD", "VND");
        BigDecimal second = adapter.rate("USD", "VND");

        assertThat(first).isEqualByComparingTo("24875.55");
        assertThat(second).isEqualByComparingTo("24875.55");
        server.verify();
    }

    @Test
    void usesFallbackRateWhenUpstreamFails() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FxProperties props = new FxProperties("https://fx.example", Duration.ofHours(24), 100, new BigDecimal("25500"));
        FrankfurterFxAdapter adapter = new FrankfurterFxAdapter(props, builder);
        server.expect(requestTo("https://fx.example/latest?from=USD&to=VND"))
                .andRespond(withServerError());

        BigDecimal rate = adapter.rate("USD", "VND");

        assertThat(rate).isEqualByComparingTo("25500");
    }

    @Test
    void identityRateForSameCurrency() {
        FxProperties props = new FxProperties(
                "https://fx.example", Duration.ofHours(24), 100, new BigDecimal("25500"));
        FrankfurterFxAdapter adapter = new FrankfurterFxAdapter(props, RestClient.builder());

        assertThat(adapter.rate("VND", "VND")).isEqualByComparingTo("1");
    }

    @Test
    void invertsFallbackForVndToUsd() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FxProperties props = new FxProperties("https://fx.example", Duration.ofHours(24), 100, new BigDecimal("25000"));
        FrankfurterFxAdapter adapter = new FrankfurterFxAdapter(props, builder);
        server.expect(requestTo("https://fx.example/latest?from=VND&to=USD"))
                .andRespond(withServerError());

        BigDecimal rate = adapter.rate("VND", "USD");

        assertThat(rate).isEqualByComparingTo("0.00004");
    }
}
