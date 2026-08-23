package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.ManageAddressUseCase;
import com.vnshop.userservice.application.UpsertBuyerProfileCommand;
import com.vnshop.userservice.application.UpsertBuyerProfileUseCase;
import com.vnshop.userservice.application.ViewBuyerProfileUseCase;
import com.vnshop.userservice.application.avatar.AvatarActivationRequest;
import com.vnshop.userservice.application.avatar.AvatarActivationResponse;
import com.vnshop.userservice.application.avatar.AvatarUploadRequest;
import com.vnshop.userservice.application.avatar.AvatarUploadResponse;
import com.vnshop.userservice.application.avatar.AvatarUploadService;
import com.vnshop.userservice.infrastructure.config.JwtPrincipalUtil;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {
    private final ViewBuyerProfileUseCase viewBuyerProfileUseCase;
    private final UpsertBuyerProfileUseCase upsertBuyerProfileUseCase;
    private final ManageAddressUseCase manageAddressUseCase;
    private final AvatarUploadService avatarUploadService;
    private final BuyerProfileResponseMapper buyerProfileResponseMapper;

    public UserController(ViewBuyerProfileUseCase viewBuyerProfileUseCase,
                          UpsertBuyerProfileUseCase upsertBuyerProfileUseCase,
                          ManageAddressUseCase manageAddressUseCase,
                          AvatarUploadService avatarUploadService,
                          BuyerProfileResponseMapper buyerProfileResponseMapper) {
        this.viewBuyerProfileUseCase = viewBuyerProfileUseCase;
        this.upsertBuyerProfileUseCase = upsertBuyerProfileUseCase;
        this.manageAddressUseCase = manageAddressUseCase;
        this.avatarUploadService = avatarUploadService;
        this.buyerProfileResponseMapper = buyerProfileResponseMapper;
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<BuyerProfileResponse> getMyProfile() {
        return ApiResponse.ok(buyerProfileResponseMapper.fromDomain(viewBuyerProfileUseCase.view(JwtPrincipalUtil.currentUserId())));
    }

    @PutMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<BuyerProfileResponse> upsertMyProfile(@RequestBody BuyerProfileRequest request) {
        return ApiResponse.ok(buyerProfileResponseMapper.fromDomain(upsertBuyerProfileUseCase.upsert(new UpsertBuyerProfileCommand(JwtPrincipalUtil.currentUserId(), request.name(), request.phone(), request.avatarUrl()))));
    }

    @PostMapping("/me/avatar/upload")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<AvatarUploadHttpResponse> createAvatarUpload(@RequestBody AvatarUploadRequest request) {
        AvatarUploadResponse response = avatarUploadService.createUpload(JwtPrincipalUtil.currentUserId(), request);
        return ApiResponse.ok(AvatarUploadHttpResponse.fromDomain(response));
    }

    @PostMapping("/me/avatar/activate")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<BuyerProfileResponse> activateAvatar(@RequestBody AvatarActivationRequest request) {
        AvatarActivationResponse response = avatarUploadService.activate(JwtPrincipalUtil.currentUserId(), request);
        return ApiResponse.ok(buyerProfileResponseMapper.fromDomain(response.profile()));
    }

    @PostMapping("/me/addresses")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<BuyerProfileResponse> addAddress(@RequestBody AddressRequest request) {
        return ApiResponse.ok(buyerProfileResponseMapper.fromDomain(manageAddressUseCase.addAddress(JwtPrincipalUtil.currentUserId(), request.toDomain())));
    }

    @PutMapping("/me/addresses/{index}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<BuyerProfileResponse> updateAddress(
            @PathVariable int index,
            @RequestBody AddressRequest request) {
        return ApiResponse.ok(buyerProfileResponseMapper.fromDomain(
                manageAddressUseCase.updateAddress(JwtPrincipalUtil.currentUserId(), index, request.toDomain())));
    }

    @DeleteMapping("/me/addresses/{index}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<BuyerProfileResponse> removeAddress(@PathVariable int index) {
        return ApiResponse.ok(buyerProfileResponseMapper.fromDomain(manageAddressUseCase.removeAddress(JwtPrincipalUtil.currentUserId(), index)));
    }

    @PutMapping("/me/addresses/{index}/default")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<BuyerProfileResponse> setDefaultAddress(@PathVariable int index) {
        return ApiResponse.ok(buyerProfileResponseMapper.fromDomain(manageAddressUseCase.setDefaultAddress(JwtPrincipalUtil.currentUserId(), index)));
    }

}
