package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.infrastructure.gateway.MomoCallbackService;
import com.vnshop.paymentservice.infrastructure.gateway.MomoIpnRequest;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayGateway;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayCallbackService;

import java.util.Map;
import java.util.Optional;

final class PaymentCallbackHandler {
    private final Optional<VnpayCallbackService> vnpayService;
    private final Optional<MomoCallbackService> momoService;

    PaymentCallbackHandler(Optional<VnpayCallbackService> vnpayService,
            Optional<MomoCallbackService> momoService) {
        this.vnpayService = vnpayService;
        this.momoService = momoService;
    }

    ApiResponse<VnpayIpnResponse> vnpayIpn(Map<String, String> parameters, Map<String, String> headers) {
        VnpayCallbackService.VnpayIpnResult result = vnpayService.orElseThrow(
                () -> new IllegalStateException("VNPay gateway is not enabled")).handleIpn(parameters, headers);
        return ApiResponse.ok(new VnpayIpnResponse(result.responseCode(), result.message()));
    }

    ApiResponse<VnpayReturnResponse> vnpayReturn(Map<String, String> parameters) {
        VnpayGateway.VnpayVerification verification = vnpayService.orElseThrow(
                () -> new IllegalStateException("VNPay gateway is not enabled")).verifyReturn(parameters);
        return ApiResponse.ok(new VnpayReturnResponse(verification.validSignature(), verification.status().name(),
                verification.paymentId(), verification.transactionNo()));
    }

    ApiResponse<MomoIpnResponse> momoIpn(MomoIpnRequest request, Map<String, String> headers) {
        MomoCallbackService.MomoIpnResult result = momoService.orElseThrow(
                () -> new IllegalStateException("MoMo gateway is not enabled")).handleIpn(request, headers);
        return ApiResponse.ok(new MomoIpnResponse(result.resultCode(), result.message()));
    }
}
