package com.vnshop.orderservice;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.vnshop.orderservice.application.shipping.ShippingQuoteRequest;
import com.vnshop.orderservice.application.shipping.ShippingQuoteResult;
import com.vnshop.orderservice.domain.ParcelDimensions;
import com.vnshop.orderservice.infrastructure.shipping.ShippingServiceQuoteAdapter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.TimeUnit;

import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

class ShippingQuoteAdapterTest {
    private HttpServer server;
    private AtomicReference<String> requestBody;
    private AtomicReference<String> correlationHeader;

    @BeforeEach
    void startServer() throws IOException {
        requestBody = new AtomicReference<>();
        correlationHeader = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/shipping/rate-quotes", this::handleRequest);
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
        MDC.clear();
    }

    @Test
    void returnsSuccessAndSendsTrustedParcel() {
        MDC.put("correlationId", "quote-success-123");
        ShippingServiceQuoteAdapter adapter = adapterWithResponse(
                "{\"data\":{\"options\":[{\"serviceCode\":\"GHN\",\"feeVnd\":25000,\"estimatedDeliveryTime\":\"2-3 days\"}]}}");

        ShippingQuoteResult result = adapter.quote(requestWithParcel());

        assertThat(result).isEqualTo(new ShippingQuoteResult.Success(java.util.List.of(
                new com.vnshop.orderservice.application.shipping.ShippingOption(
                        "GHN", java.math.BigDecimal.valueOf(25000), "2-3 days"))));
        assertThat(requestBody.get()).contains("\"weightGrams\":1200");
        assertThat(requestBody.get()).contains("\"lengthCm\":30");
        assertThat(correlationHeader.get()).isEqualTo("quote-success-123");
    }

    @Test
    void returnsNoOptionsOnlyForAnExplicitEmptyOptionsArray() {
        ShippingServiceQuoteAdapter adapter = adapterWithResponse("{\"data\":{\"options\":[]}}");

        assertThat(adapter.quote(requestWithParcel())).isEqualTo(new ShippingQuoteResult.NoOptions());
    }

    @Test
    void returnsInvalidParcelMetadataWithoutCallingShippingService() {
        ShippingServiceQuoteAdapter adapter = adapterWithResponse("{\"data\":{\"options\":[]}}");

        assertThat(adapter.quote(new ShippingQuoteRequest("street", "ward", "district", "city", null)))
                .isEqualTo(new ShippingQuoteResult.InvalidParcelMetadata("trusted parcel metadata is required"));
        assertThat(requestBody.get()).isNull();
    }

    @Test
    void returnsDependencyUnavailableForMalformedResponse() {
        ShippingServiceQuoteAdapter adapter = adapterWithResponse("not-json");

        assertThat(adapter.quote(requestWithParcel()))
                .isInstanceOf(ShippingQuoteResult.DependencyUnavailable.class);
    }

    @Test
    void returnsDependencyUnavailableWhenShippingServiceTimesOut() {
        server.removeContext("/shipping/rate-quotes");
        server.createContext("/shipping/rate-quotes", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            try {
                TimeUnit.MILLISECONDS.sleep(200);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
            respond(exchange, "{\"data\":{\"options\":[]}}");
        });
        ShippingServiceQuoteAdapter adapter = new ShippingServiceQuoteAdapter(
                "http://localhost:" + server.getAddress().getPort(), 1000, 50);

        assertThat(adapter.quote(requestWithParcel()))
                .isEqualTo(new ShippingQuoteResult.DependencyUnavailable("shipping-service rate quote failed"));
    }

    private ShippingServiceQuoteAdapter adapterWithResponse(String response) {
        requestBody.set(null);
        server.removeContext("/shipping/rate-quotes");
        server.createContext("/shipping/rate-quotes", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            correlationHeader.set(exchange.getRequestHeaders().getFirst("X-Correlation-Id"));
            respond(exchange, response);
        });
        return new ShippingServiceQuoteAdapter(
                "http://localhost:" + server.getAddress().getPort(), 1000, 2500);
    }

    private ShippingQuoteRequest requestWithParcel() {
        return new ShippingQuoteRequest(
                "street", "ward", "district", "city", new ParcelDimensions(1200, 30, 20, 10, 125000));
    }

    private void handleRequest(HttpExchange exchange) throws IOException {
        requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        correlationHeader.set(exchange.getRequestHeaders().getFirst("X-Correlation-Id"));
        respond(exchange, "{\"data\":{\"options\":[]}}");
    }

    private static void respond(HttpExchange exchange, String response) throws IOException {
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(200, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
