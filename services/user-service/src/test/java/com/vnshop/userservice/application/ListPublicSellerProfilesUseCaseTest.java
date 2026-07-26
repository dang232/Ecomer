package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ListPublicSellerProfilesUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    private ListPublicSellerProfilesUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new ListPublicSellerProfilesUseCase(userRepositoryPort);
    }

    private SellerProfile seller(String id, String shopName) {
        return new SellerProfile(
                id, shopName, "VNBank", null,
                true, Tier.STANDARD, false,
                null, null, null, Instant.now(), null
        );
    }

    @Test
    void list_nullIds_returnsEmptyList() {
        List<SellerProfile> result = useCase.list(null);

        assertThat(result).isEmpty();
        verify(userRepositoryPort, never()).findSellersByIds(any());
    }

    @Test
    void list_emptyIds_returnsEmptyList() {
        List<SellerProfile> result = useCase.list(List.of());

        assertThat(result).isEmpty();
        verify(userRepositoryPort, never()).findSellersByIds(any());
    }

    @Test
    void list_filtersNullIds() {
        when(userRepositoryPort.findSellersByIds(any())).thenReturn(List.of());

        useCase.list(Arrays.asList(null, "s1", null));

        verify(userRepositoryPort).findSellersByIds(List.of("s1"));
    }

    @Test
    void list_trimsWhitespace() {
        when(userRepositoryPort.findSellersByIds(any())).thenReturn(List.of());

        useCase.list(List.of("  s1  ", " s2 "));

        verify(userRepositoryPort).findSellersByIds(List.of("s1", "s2"));
    }

    @Test
    void list_filtersBlankIds() {
        when(userRepositoryPort.findSellersByIds(any())).thenReturn(List.of());

        useCase.list(List.of("s1", "   ", "", "  "));

        verify(userRepositoryPort).findSellersByIds(List.of("s1"));
    }

    @Test
    void list_removesDuplicates() {
        when(userRepositoryPort.findSellersByIds(any())).thenReturn(List.of());

        useCase.list(List.of("s1", "s2", "s1"));

        verify(userRepositoryPort).findSellersByIds(List.of("s1", "s2"));
    }

    @Test
    void list_capsAt100Ids() {
        when(userRepositoryPort.findSellersByIds(any())).thenReturn(List.of());

        List<String> ids = java.util.stream.IntStream.rangeClosed(1, 150)
                .mapToObj(i -> "seller-" + i)
                .toList();

        useCase.list(ids);

        verify(userRepositoryPort).findSellersByIds(
                java.util.stream.IntStream.rangeClosed(1, 100)
                        .mapToObj(i -> "seller-" + i)
                        .toList()
        );
    }

    @Test
    void list_boundedListBecomesEmptyAfterFiltering_returnsEmptyList() {
        List<SellerProfile> result = useCase.list(Arrays.asList(null, "   ", ""));

        assertThat(result).isEmpty();
        verify(userRepositoryPort, never()).findSellersByIds(any());
    }

    @Test
    void list_happyPath_delegatesToRepository() {
        SellerProfile s1 = seller("s1", "Shop A");
        SellerProfile s2 = seller("s2", "Shop B");
        when(userRepositoryPort.findSellersByIds(List.of("s1", "s2"))).thenReturn(List.of(s1, s2));

        List<SellerProfile> result = useCase.list(List.of("s1", "s2"));

        assertThat(result).hasSize(2);
    }
}
