package com.vnshop.productservice.infrastructure.user;

import org.junit.jupiter.api.Test;
import org.springframework.web.service.annotation.GetExchange;

import static org.assertj.core.api.Assertions.assertThat;

class UserServiceHttpClientContractTest {
    @Test
    void publicProfileLookupUsesSpringHttpInterfaceMapping() throws NoSuchMethodException {
        GetExchange exchange = UserServiceHttpClient.class
                .getMethod("list", java.util.List.class)
                .getAnnotation(GetExchange.class);

        assertThat(exchange).isNotNull();
        assertThat(exchange.value()).isEqualTo("/users/public-profiles");
    }
}
