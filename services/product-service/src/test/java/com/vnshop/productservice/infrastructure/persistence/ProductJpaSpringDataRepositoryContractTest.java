package com.vnshop.productservice.infrastructure.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class ProductJpaSpringDataRepositoryContractTest {
    @Test
    void buyerCatalogOnlyIncludesActiveProducts() throws NoSuchMethodException {
        Method method = ProductJpaSpringDataRepository.class.getMethod(
                "findCatalog", String.class, String.class, String.class,
                org.springframework.data.domain.Pageable.class);

        assertThat(method.getAnnotation(Query.class).value())
                .contains("product.status = 'ACTIVE'");
    }
}
