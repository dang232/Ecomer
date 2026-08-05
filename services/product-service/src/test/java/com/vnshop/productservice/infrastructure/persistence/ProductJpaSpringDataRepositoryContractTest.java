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

    @Test
    void sellerManagementQueryScopesSellerAndExcludesDeletedProducts() throws NoSuchMethodException {
        Method method = ProductJpaSpringDataRepository.class.getMethod(
                "findSellerProducts", String.class, String.class, String.class, String.class,
                org.springframework.data.domain.Pageable.class);

        assertThat(method.getAnnotation(Query.class).value())
                .contains("product.sellerId = :sellerId")
                .contains("product.status <> 'DELETED'")
                .contains(":q is null")
                .contains("cast(:q as string)")
                .contains(":categoryId is null")
                .contains(":status is null")
                .contains("order by product.createdAt desc, product.id desc");
    }

    @Test
    void cursorAnchorsHaveExplicitTypesWhenTheFirstPageHasNoCursor() throws NoSuchMethodException {
        assertThat(queryFor("findCatalogAfterNewest"))
                .contains("cast(:anchorCreatedAt as Instant)");
        assertThat(queryFor("findCatalogAfterPriceLow"))
                .contains("cast(:anchorPrice as BigDecimal)");
        assertThat(queryFor("findCatalogAfterPriceHigh"))
                .contains("cast(:anchorPrice as BigDecimal)");
    }

    private static String queryFor(String methodName) throws NoSuchMethodException {
        return java.util.Arrays.stream(ProductJpaSpringDataRepository.class.getMethods())
                .filter(method -> method.getName().equals(methodName))
                .findFirst()
                .orElseThrow()
                .getAnnotation(Query.class)
                .value();
    }
}
