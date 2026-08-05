package com.vnshop.searchservice.infrastructure.elasticsearch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.searchservice.application.SearchRepository;
import com.vnshop.searchservice.infrastructure.config.SearchFacetProperties;
import com.vnshop.searchservice.domain.ProductReadModel;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHits;

class ElasticsearchSearchAdapterTest {

    private final ElasticsearchOperations elasticsearchOperations = mock(ElasticsearchOperations.class);
    private final SearchRepository fallbackRepository = mock(SearchRepository.class);
    private final ElasticsearchSearchAdapter adapter = new ElasticsearchSearchAdapter(
            elasticsearchOperations,
            fallbackRepository,
            new SearchFacetProperties(100));

    @Test
    void searchPaged_delegatesToReadModelWhenElasticsearchIsUnavailable() {
        PageRequest pageable = PageRequest.of(0, 20);
        Page<ProductReadModel> fallbackPage = new PageImpl<>(List.of(product()), pageable, 1);

        when(elasticsearchOperations.search(any(NativeQuery.class), eq(ProductDocument.class)))
                .thenThrow(new IllegalStateException("elasticsearch unavailable"));
        when(fallbackRepository.searchPaged(
                eq("phone"), eq("electronics"), eq("Acme"), any(), any(), eq(true), eq(false), eq(false),
                eq(pageable)))
                .thenReturn(fallbackPage);

        Page<ProductReadModel> result = adapter.searchPaged(
                "phone", "electronics", "Acme", BigDecimal.ONE, BigDecimal.TEN,
                true, false, false, pageable);

        assertThat(result).isSameAs(fallbackPage);
        verify(fallbackRepository).searchPaged(
                "phone", "electronics", "Acme", BigDecimal.ONE, BigDecimal.TEN,
                true, false, false, pageable);
    }

    @Test
    void searchPaged_delegatesToReadModelWhenTheIndexHasNoMatchingDocuments() {
        PageRequest pageable = PageRequest.of(0, 20);
        Page<ProductReadModel> fallbackPage = new PageImpl<>(List.of(product()), pageable, 1);
        SearchHits<ProductDocument> hits = mock(SearchHits.class);

        when(hits.getTotalHits()).thenReturn(0L);
        when(hits.getSearchHits()).thenReturn(List.of());
        when(elasticsearchOperations.search(any(NativeQuery.class), eq(ProductDocument.class)))
                .thenReturn(hits);
        when(fallbackRepository.searchPaged(
                eq(null), eq("electronics"), eq(null), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(pageable)))
                .thenReturn(fallbackPage);

        Page<ProductReadModel> result = adapter.searchPaged(
                null, "electronics", null, null, null, null, null, null, pageable);

        assertThat(result).isSameAs(fallbackPage);
        verify(fallbackRepository).searchPaged(
                null, "electronics", null, null, null, null, null, null, pageable);
    }

    @Test
    void tagFacetsAggregateTheKeywordFieldInsteadOfAnalyzedText() {
        SearchHits<ProductDocument> hits = mock(SearchHits.class);
        when(hits.getAggregations()).thenReturn(null);
        when(elasticsearchOperations.search(any(NativeQuery.class), eq(ProductDocument.class)))
                .thenReturn(hits);
        when(fallbackRepository.tagFacetsFor(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        adapter.tagFacetsFor(null, null, null, null, null, null, List.of(), null, null, null);

        ArgumentCaptor<NativeQuery> queryCaptor = ArgumentCaptor.forClass(NativeQuery.class);
        verify(elasticsearchOperations).search(queryCaptor.capture(), eq(ProductDocument.class));
        assertThat(queryCaptor.getValue().getAggregations()).containsKey("tags.keyword");
    }

    private static ProductReadModel product() {
        return new ProductReadModel(
                "p1", "Phone", "desc", "electronics", "Acme", "DRAFT",
                BigDecimal.ONE, BigDecimal.TEN, 1, null, 0, Instant.now(), true, false, false);
    }
}
