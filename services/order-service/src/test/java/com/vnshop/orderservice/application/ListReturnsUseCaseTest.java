package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ListReturnsUseCaseTest {
    private final ReturnRepositoryPort repository = mock(ReturnRepositoryPort.class);
    private final ListReturnsUseCase useCase = new ListReturnsUseCase(repository);

    @Test
    void listsReturnsForTheAuthenticatedSeller() {
        Return returnRequest = new Return(
                UUID.randomUUID(), UUID.randomUUID().toString(), 42L, "buyer-1", "Damaged item");
        when(repository.findBySellerId("seller-1")).thenReturn(List.of(returnRequest));

        assertThat(useCase.listBySellerId("seller-1")).containsExactly(returnRequest);
        verify(repository).findBySellerId("seller-1");
    }

    @Test
    void rejectsBlankSellerIdsBeforeReadingTheRepository() {
        assertThatThrownBy(() -> useCase.listBySellerId("  "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("sellerId is required");
    }
}
