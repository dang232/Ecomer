package com.vnshop.searchservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.searchservice.application.SearchProductsUseCase;
import com.vnshop.searchservice.application.SearchV2Response;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletResponse;

class SearchControllerV2Test {
    private final SearchProductsUseCase useCase = mock(SearchProductsUseCase.class);
    private final SearchController controller = new SearchController(useCase);

    @Test
    void returnsStableEtagAnd304WithoutAResponseBody() {
        SearchV2Response data = new SearchV2Response(List.of(), null, false, null);
        when(useCase.searchV2(org.mockito.ArgumentMatchers.any())).thenReturn(data);
        MockHttpServletResponse firstServletResponse = new MockHttpServletResponse();

        ResponseEntity<ApiResponse<SearchV2Response>> first = controller.searchV2(
                "phone", null, null, null, null, "newest", null, null, null,
                null, 24, false, "corr-1", null, null, firstServletResponse);

        assertThat(first.getStatusCode().value()).isEqualTo(200);
        assertThat(first.getHeaders().getETag()).isNotBlank();
        assertThat(first.getBody()).isNotNull();
        assertThat(first.getBody().meta().requestId()).isEqualTo("corr-1");

        MockHttpServletResponse secondServletResponse = new MockHttpServletResponse();
        ResponseEntity<ApiResponse<SearchV2Response>> second = controller.searchV2(
                "phone", null, null, null, null, "newest", null, null, null,
                null, 24, false, "corr-2", null, first.getHeaders().getETag(), secondServletResponse);

        assertThat(second.getStatusCode().value()).isEqualTo(304);
        assertThat(second.getBody()).isNull();
    }
}
