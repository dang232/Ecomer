package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerNotFoundException;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.port.out.SellerStatsPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GetPublicSellerUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private SellerStatsPort sellerStatsPort;

    private GetPublicSellerUseCase useCase;

    private static final String SELLER_ID = "seller-abc";
    private static final Instant JOINED_AT = Instant.parse("2024-01-15T10:00:00Z");

    @BeforeEach
    void setUp() {
        useCase = new GetPublicSellerUseCase(userRepositoryPort, sellerStatsPort);
    }

    @Test
    void view_happyPath_returnsFullView() {
        SellerProfile seller = new SellerProfile(
                SELLER_ID, "Cool Shop", "BankA", null,
                true, Tier.STANDARD, false,
                "Best shop around", "http://logo.png", "http://banner.png", JOINED_AT, null
        );
        when(userRepositoryPort.findSellerById(SELLER_ID)).thenReturn(Optional.of(seller));
        when(sellerStatsPort.sellerStats(SELLER_ID)).thenReturn(new SellerStatsPort.SellerStats(4.5, 120L));
        when(sellerStatsPort.productCount(SELLER_ID)).thenReturn(35L);

        PublicSellerView view = useCase.view(SELLER_ID);

        assertThat(view.sellerId()).isEqualTo(SELLER_ID);
        assertThat(view.shopName()).isEqualTo("Cool Shop");
        assertThat(view.description()).isEqualTo("Best shop around");
        assertThat(view.logoUrl()).isEqualTo("http://logo.png");
        assertThat(view.bannerUrl()).isEqualTo("http://banner.png");
        assertThat(view.joinedAt()).isEqualTo(JOINED_AT);
        assertThat(view.tier()).isEqualTo("STANDARD");
        assertThat(view.ratingAvg()).isEqualTo(4.5);
        assertThat(view.ratingCount()).isEqualTo(120L);
        assertThat(view.totalProducts()).isEqualTo(35L);
    }

    @Test
    void view_sellerNotFound_throwsSellerNotFoundException() {
        when(userRepositoryPort.findSellerById(SELLER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.view(SELLER_ID))
                .isInstanceOf(SellerNotFoundException.class)
                .hasMessageContaining(SELLER_ID);
    }

    @Test
    void view_degradedStats_stillReturnsSeller() {
        SellerProfile seller = new SellerProfile(
                SELLER_ID, "Cool Shop", "BankA", null,
                true, Tier.VERIFIED, false,
                null, null, null, JOINED_AT, null
        );
        when(userRepositoryPort.findSellerById(SELLER_ID)).thenReturn(Optional.of(seller));
        // port returns zero/empty (simulates product-service down)
        when(sellerStatsPort.sellerStats(SELLER_ID)).thenReturn(new SellerStatsPort.SellerStats(null, 0L));
        when(sellerStatsPort.productCount(SELLER_ID)).thenReturn(0L);

        PublicSellerView view = useCase.view(SELLER_ID);

        assertThat(view.sellerId()).isEqualTo(SELLER_ID);
        assertThat(view.ratingAvg()).isNull();
        assertThat(view.ratingCount()).isZero();
        assertThat(view.totalProducts()).isZero();
        assertThat(view.tier()).isEqualTo("VERIFIED");
    }
}
