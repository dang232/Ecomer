package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.ListPublicSellerProfilesUseCase;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public, batchable shop-name projection used by downstream read models. */
@RestController
@RequestMapping("/sellers/public-profiles")
public class SellerPublicProfileController {
    private final ListPublicSellerProfilesUseCase listPublicSellerProfilesUseCase;

    public SellerPublicProfileController(ListPublicSellerProfilesUseCase listPublicSellerProfilesUseCase) {
        this.listPublicSellerProfilesUseCase = listPublicSellerProfilesUseCase;
    }

    @GetMapping
    public ApiResponse<List<PublicSellerProfileResponse>> list(
            @RequestParam(value = "ids", required = false) List<String> ids) {
        return ApiResponse.ok(listPublicSellerProfilesUseCase.list(ids).stream()
                .map(PublicSellerProfileResponse::fromDomain)
                .toList());
    }

    public record PublicSellerProfileResponse(String sellerId, String displayName) {
        static PublicSellerProfileResponse fromDomain(com.vnshop.userservice.domain.SellerProfile profile) {
            return new PublicSellerProfileResponse(profile.id(), profile.shopName());
        }
    }
}
