package com.vnshop.userservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import com.vnshop.userservice.application.PhoneAlreadyRegisteredException;
import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.sql.SQLException;
import java.util.List;
import java.util.stream.Stream;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserJpaRepositoryTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private TypedQuery<BuyerProfileJpaEntity> buyerQuery;

    private UserJpaRepository repository;

    @BeforeEach
    void setUp() {
        repository = new UserJpaRepository(entityManager);
        when(entityManager.createQuery(any(String.class), eq(BuyerProfileJpaEntity.class))).thenReturn(buyerQuery);
        when(buyerQuery.setParameter(eq("keycloakId"), any())).thenReturn(buyerQuery);
        when(buyerQuery.getResultStream()).thenReturn(Stream.empty());
        when(entityManager.merge(any(BuyerProfileJpaEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void saveBuyer_phoneClaimUniqueRace_isMappedToStablePhoneConflict() {
        doThrow(new ConstraintViolationException(
                "duplicate phone claim",
                new SQLException("duplicate key"),
                "insert into user_svc.buyer_profiles",
                "uq_buyer_profiles_phone_claim"))
                .when(entityManager)
                .flush();

        BuyerProfile buyer = new BuyerProfile(
                "kc-new", "buyer@example.com", "Buyer", new PhoneNumber("+84912345678"), null, List.of());

        assertThatThrownBy(() -> repository.saveBuyer(buyer))
                .isInstanceOf(PhoneAlreadyRegisteredException.class);
    }

    @Test
    void anonymize_releasesThePhoneClaimAlongsideThePhone() {
        BuyerProfileJpaEntity entity = new BuyerProfileJpaEntity();
        entity.setKeycloakId("kc-deleted");
        entity.setPhone("+84912345678");
        entity.setPhoneClaim("+84912345678");
        when(buyerQuery.getResultStream()).thenReturn(Stream.of(entity));

        repository.anonymize("kc-deleted");

        assertThat(entity.getPhone()).isNull();
        assertThat(entity.getPhoneClaim()).isNull();
    }
}
