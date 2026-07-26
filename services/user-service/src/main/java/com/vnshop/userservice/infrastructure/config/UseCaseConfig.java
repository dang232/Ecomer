package com.vnshop.userservice.infrastructure.config;

import com.vnshop.userservice.application.AdminUserUseCase;
import com.vnshop.userservice.application.ApproveSellerUseCase;
import com.vnshop.userservice.application.AuthSessionUseCase;
import com.vnshop.userservice.application.EnrollSellerPayoutDestinationUseCase;
import com.vnshop.userservice.application.GetPublicSellerUseCase;
import com.vnshop.userservice.application.RejectSellerUseCase;
import com.vnshop.userservice.application.ListBuyerPublicProfilesUseCase;
import com.vnshop.userservice.application.ListPendingSellersUseCase;
import com.vnshop.userservice.application.ListPublicSellersUseCase;
import com.vnshop.userservice.application.ListPublicSellerProfilesUseCase;
import com.vnshop.userservice.application.LookupSellerDestinationUseCase;
import com.vnshop.userservice.application.ManageAddressUseCase;
import com.vnshop.userservice.application.RegisterBuyerUseCase;
import com.vnshop.userservice.application.RegisterSellerUseCase;
import com.vnshop.userservice.application.UpsertBuyerProfileUseCase;
import com.vnshop.userservice.application.ViewBuyerProfileUseCase;
import com.vnshop.userservice.application.ViewSellerProfileUseCase;
import com.vnshop.userservice.application.WishlistUseCase;
import com.vnshop.userservice.application.avatar.AvatarUploadService;
import com.vnshop.userservice.domain.payoutdestination.CipherPort;
import com.vnshop.userservice.domain.port.out.KeycloakAdminPort;
import com.vnshop.userservice.domain.port.out.KeycloakTokenPort;
import com.vnshop.userservice.domain.port.out.ObjectStoragePort;
import com.vnshop.userservice.domain.port.out.SellerStatsPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import com.vnshop.userservice.domain.port.out.WishlistRepositoryPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

@Configuration
public class UseCaseConfig {
    @Bean("internalServiceAuthorization")
    InternalServiceAuthorization internalServiceAuthorization(
            @Value("${vnshop.internal.allowed-client-id}") String allowedClientId) {
        return new InternalServiceAuthorization(allowedClientId);
    }
    @Bean
    AdminUserUseCase adminUserUseCase(UserRepositoryPort userRepositoryPort, KeycloakAdminPort keycloakAdminPort) {
        return new AdminUserUseCase(userRepositoryPort, keycloakAdminPort);
    }

    @Bean
    RegisterBuyerUseCase registerBuyerUseCase(UserRepositoryPort userRepositoryPort) {
        return new RegisterBuyerUseCase(userRepositoryPort);
    }

    @Bean
    ManageAddressUseCase manageAddressUseCase(UserRepositoryPort userRepositoryPort) {
        return new ManageAddressUseCase(userRepositoryPort);
    }

    @Bean
    RegisterSellerUseCase registerSellerUseCase(UserRepositoryPort userRepositoryPort) {
        return new RegisterSellerUseCase(userRepositoryPort);
    }

    @Bean
    ApproveSellerUseCase approveSellerUseCase(UserRepositoryPort userRepositoryPort) {
        return new ApproveSellerUseCase(userRepositoryPort);
    }

    @Bean
    RejectSellerUseCase rejectSellerUseCase(UserRepositoryPort userRepositoryPort) {
        return new RejectSellerUseCase(userRepositoryPort);
    }

    @Bean
    ListPendingSellersUseCase listPendingSellersUseCase(UserRepositoryPort userRepositoryPort) {
        return new ListPendingSellersUseCase(userRepositoryPort);
    }

    @Bean
    UpsertBuyerProfileUseCase upsertBuyerProfileUseCase(UserRepositoryPort userRepositoryPort, RegisterBuyerUseCase registerBuyerUseCase) {
        return new UpsertBuyerProfileUseCase(userRepositoryPort, registerBuyerUseCase);
    }

    @Bean
    ViewBuyerProfileUseCase viewBuyerProfileUseCase(UserRepositoryPort userRepositoryPort) {
        return new ViewBuyerProfileUseCase(userRepositoryPort);
    }

    @Bean
    ListBuyerPublicProfilesUseCase listBuyerPublicProfilesUseCase(UserRepositoryPort userRepositoryPort) {
        return new ListBuyerPublicProfilesUseCase(userRepositoryPort);
    }

    @Bean
    ListPublicSellerProfilesUseCase listPublicSellerProfilesUseCase(UserRepositoryPort userRepositoryPort) {
        return new ListPublicSellerProfilesUseCase(userRepositoryPort);
    }

    @Bean
    ViewSellerProfileUseCase viewSellerProfileUseCase(UserRepositoryPort userRepositoryPort) {
        return new ViewSellerProfileUseCase(userRepositoryPort);
    }

    @Bean
    WishlistUseCase wishlistUseCase(WishlistRepositoryPort wishlistRepositoryPort) {
        return new WishlistUseCase(wishlistRepositoryPort);
    }

    @Bean
    GetPublicSellerUseCase getPublicSellerUseCase(UserRepositoryPort userRepositoryPort, SellerStatsPort sellerStatsPort) {
        return new GetPublicSellerUseCase(userRepositoryPort, sellerStatsPort);
    }

    @Bean
    ListPublicSellersUseCase listPublicSellersUseCase(UserRepositoryPort userRepositoryPort, SellerStatsPort sellerStatsPort) {
        return new ListPublicSellersUseCase(userRepositoryPort, sellerStatsPort);
    }

    @Bean
    AuthSessionUseCase authSessionUseCase(KeycloakTokenPort tokenPort) {
        return new AuthSessionUseCase(tokenPort);
    }

    @Bean
    EnrollSellerPayoutDestinationUseCase enrollSellerPayoutDestinationUseCase(
            UserRepositoryPort userRepositoryPort, CipherPort cipher) {
        return new EnrollSellerPayoutDestinationUseCase(userRepositoryPort, cipher);
    }

    @Bean
    LookupSellerDestinationUseCase lookupSellerDestinationUseCase(UserRepositoryPort userRepositoryPort) {
        return new LookupSellerDestinationUseCase(userRepositoryPort);
    }

    @Bean
    AvatarUploadService avatarUploadService(UserRepositoryPort userRepositoryPort,
                                            ObjectStoragePort objectStoragePort,
                                            RegisterBuyerUseCase registerBuyerUseCase) {
        return new AvatarUploadService(userRepositoryPort, objectStoragePort, registerBuyerUseCase);
    }
}
