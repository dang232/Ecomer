package com.vnshop.searchservice.infrastructure.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class ProductReadModelRepositoryContractTest {
    @Test
    void everyBuyerReadModelQueryFiltersToActiveProducts() throws NoSuchMethodException {
        assertThat(queryFor("searchEntitiesPaged")).contains("product.status = 'ACTIVE'");
        assertThat(queryFor("findDistinctCategories")).contains("product.status = 'ACTIVE'");
        assertThat(queryFor("findSuggestions")).contains("product.status = 'ACTIVE'");
        assertThat(queryFor("categoryFacets")).contains("product.status = 'ACTIVE'");
        assertThat(queryFor("brandFacets")).contains("product.status = 'ACTIVE'");
    }

    private static String queryFor(String methodName) throws NoSuchMethodException {
        Method method = java.util.Arrays.stream(ProductReadModelRepository.class.getMethods())
                .filter(candidate -> candidate.getName().equals(methodName))
                .findFirst()
                .orElseThrow();
        return method.getAnnotation(Query.class).value();
    }
}
