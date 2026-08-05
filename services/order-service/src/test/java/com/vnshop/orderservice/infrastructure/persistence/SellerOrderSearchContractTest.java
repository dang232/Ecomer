package com.vnshop.orderservice.infrastructure.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import static org.assertj.core.api.Assertions.assertThat;

class SellerOrderSearchContractTest {

    @Test
    void sellerSearchIncludesTheSubOrderNumberShownByTheSellerUi() throws NoSuchMethodException {
        Query query = OrderJpaSpringDataRepository.class
                .getMethod(
                        "findBySellerIdAndFulfillmentStatusInAndQuery",
                        String.class,
                        java.util.List.class,
                        String.class,
                        String.class)
                .getAnnotation(Query.class);

        assertThat(query).isNotNull();
        assertThat(query.value()).contains("str(sub.id)");
    }
}
