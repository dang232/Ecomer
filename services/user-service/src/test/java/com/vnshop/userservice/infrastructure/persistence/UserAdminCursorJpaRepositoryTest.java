package com.vnshop.userservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.userservice.domain.port.out.AdminSellerCursor;
import com.vnshop.userservice.domain.SellerProfile;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserAdminCursorJpaRepositoryTest {
    @Mock
    private EntityManager entityManager;

    @Mock
    private TypedQuery<SellerProfileJpaEntity> sellerQuery;

    private UserAdminCursorJpaRepository repository;

    @BeforeEach
    void setUp() {
        repository = new UserAdminCursorJpaRepository(entityManager);
        when(entityManager.createQuery(any(String.class), eq(SellerProfileJpaEntity.class))).thenReturn(sellerQuery);
        when(sellerQuery.setParameter(any(String.class), any())).thenReturn(sellerQuery);
        when(sellerQuery.setMaxResults(any(Integer.class))).thenReturn(sellerQuery);
        when(sellerQuery.getResultList()).thenReturn(List.of());
    }

    @Test
    void firstPage_doesNotBindOutOfRangeAnchorTimestamp() {
        List<SellerProfile> result = repository.findPendingSellers(null, null, 51);

        assertThat(result).isEmpty();
        verify(sellerQuery).setParameter("prefix", "%");
        verify(sellerQuery, never()).setParameter(eq("anchorTime"), any());
        verify(sellerQuery, never()).setParameter(eq("anchorId"), any());
    }

    @Test
    void anchoredPage_bindsRawUniqueKeycloakIdAndTimestamp() {
        Instant anchorTime = Instant.parse("2026-08-08T00:00:00Z");

        repository.findPendingSellers(null, new AdminSellerCursor(anchorTime, "Seller-Z"), 51);

        verify(sellerQuery).setParameter("anchorTime", anchorTime);
        verify(sellerQuery).setParameter("anchorId", "Seller-Z");
    }
}
