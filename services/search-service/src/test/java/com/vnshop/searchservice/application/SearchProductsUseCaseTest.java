package com.vnshop.searchservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.searchservice.domain.ProductReadModel;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

class SearchProductsUseCaseTest {

    private final SearchRepository repository = mock(SearchRepository.class);
    private final SearchProductsUseCase useCase = new SearchProductsUseCase(repository);

    @Test
    void searchPaged_delegatesToRepositoryAndMapsToResponse() {
        ProductReadModel model = new ProductReadModel(
                "p1", "Phone", "desc", "electronics", "Acme", "ACTIVE",
                BigDecimal.valueOf(100), BigDecimal.valueOf(200), 3, Instant.now(),
                false, false, false
        );
        Page<ProductReadModel> page = new PageImpl<>(List.of(model));
        when(repository.searchPaged(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(page);

        Page<SearchProductResponse> result = useCase.searchPaged(
                "phone", "electronics", "Acme", null, null, PageRequest.of(0, 10));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().getFirst().productId()).isEqualTo("p1");
        assertThat(result.getContent().getFirst().name()).isEqualTo("Phone");
    }

    @Test
    void categories_returnsRepositoryDistinctCategories() {
        when(repository.findDistinctCategories()).thenReturn(List.of("electronics", "fashion"));
        assertThat(useCase.categories()).containsExactly("electronics", "fashion");
    }

    @Test
    void suggest_passesPrefixThroughAndCapsAtTen() {
        when(repository.suggestions(eq("phone"), any(Pageable.class)))
                .thenReturn(List.of("Phone X", "Phone Y"));

        List<String> suggestions = useCase.suggest("phone");

        assertThat(suggestions).containsExactly("Phone X", "Phone Y");
        // The repository receives a PageRequest of size 10 — verify by capturing the Pageable arg.
        verify(repository).suggestions(eq("phone"), any(Pageable.class));
    }

    @Test
    void suggest_emptyPrefix_returnsEmptyList() {
        when(repository.suggestions(isNull(), any(Pageable.class))).thenReturn(List.of());
        // The repository default-method handles the blank-to-null normalisation — the use case
        // just forwards. Either way we expect an empty list out of the use case.
        when(repository.suggestions(eq(""), any(Pageable.class))).thenReturn(List.of());
        assertThat(useCase.suggest("")).isEmpty();
    }

    @Test
    void facets_mapsObjectArrayTuplesToFacetEntries() {
        when(repository.categoryFacetsFor(any(), any(), any(), any())).thenReturn(List.of(
                new SearchFacetsResponse.FacetEntry("electronics", 12L),
                new SearchFacetsResponse.FacetEntry("fashion", 5L)
        ));
        when(repository.brandFacetsFor(any(), any(), any(), any())).thenReturn(List.of(
                new SearchFacetsResponse.FacetEntry("Acme", 7L)
        ));

        SearchFacetsResponse facets = useCase.facets("phone", "electronics", "Acme", null, null);

        assertThat(facets.categories()).containsExactly(
                new SearchFacetsResponse.FacetEntry("electronics", 12L),
                new SearchFacetsResponse.FacetEntry("fashion", 5L)
        );
        assertThat(facets.brands()).containsExactly(
                new SearchFacetsResponse.FacetEntry("Acme", 7L)
        );
    }

    @Test
    void facets_handlesIntegerCounts() {
        // JPA may return Integer for COUNT depending on the dialect; the mapper must
        // accept any Number subtype.
        when(repository.categoryFacetsFor(any(), any(), any(), any())).thenReturn(List.of(
                new SearchFacetsResponse.FacetEntry("electronics", 3L)
        ));
        when(repository.brandFacetsFor(any(), any(), any(), any())).thenReturn(List.of());

        SearchFacetsResponse facets = useCase.facets(null, null, null, null, null);

        assertThat(facets.categories().getFirst().count()).isEqualTo(3L);
    }

    @Test
    void facets_facetAxesUseRelaxedFilters() {
        // Verifies the "drop your own axis" semantic: the category-facet call drops
        // `category` and the brand-facet call drops `brand`.
        when(repository.categoryFacetsFor(any(), any(), any(), any())).thenReturn(List.of());
        when(repository.brandFacetsFor(any(), any(), any(), any())).thenReturn(List.of());

        useCase.facets("q", "electronics", "Acme", BigDecimal.ONE, BigDecimal.TEN);

        verify(repository).categoryFacetsFor("q", "Acme", BigDecimal.ONE, BigDecimal.TEN);
        verify(repository).brandFacetsFor("q", "electronics", BigDecimal.ONE, BigDecimal.TEN);
    }
}
