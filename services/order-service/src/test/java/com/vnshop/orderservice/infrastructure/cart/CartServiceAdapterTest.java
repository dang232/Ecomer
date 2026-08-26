package com.vnshop.orderservice.infrastructure.cart;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import org.junit.jupiter.api.Test;

class CartServiceAdapterTest {

    @Test
    void mapsCartVariantIdIntoCheckoutSnapshot() {
        CartHttpClient client = mock(CartHttpClient.class);
        when(client.getCart("user-1")).thenReturn("""
                {
                  "success": true,
                  "message": "ok",
                  "data": {
                    "items": [{
                      "productId": "product-1",
                      "variantId": "sku-large",
                      "productName": "Keyboard",
                      "quantity": 1,
                      "unitPrice": {"amount": 125000, "currency": "VND"}
                    }]
                  }
                }
                """);

        CartServiceAdapter adapter = new CartServiceAdapter(
                client,
                new ObjectMapper(),
                CircuitBreaker.ofDefaults("cart-adapter-test"));

        assertThat(adapter.findByCartId("user-1").items().getFirst().variantSku())
                .isEqualTo("sku-large");
    }
}
