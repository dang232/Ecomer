package com.vnshop.inventoryservice.infrastructure.web;

import com.vnshop.inventoryservice.application.GetActiveFlashSaleCampaignsUseCase;
import com.vnshop.inventoryservice.application.ReserveFlashSaleCommand;
import com.vnshop.inventoryservice.application.ReserveFlashSaleResult;
import com.vnshop.inventoryservice.application.ReserveFlashSaleUseCase;
import com.vnshop.inventoryservice.infrastructure.flash.ActiveFlashSaleCampaignResponse;
import com.vnshop.inventoryservice.infrastructure.flash.ApiResponse;
import com.vnshop.inventoryservice.infrastructure.flash.ReserveFlashSaleRequest;
import com.vnshop.inventoryservice.infrastructure.flash.ReserveFlashSaleResponse;
import com.vnshop.inventoryservice.infrastructure.flash.StockResponse;
import com.vnshop.inventoryservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/flash-sale")
public class FlashSaleController {
	private final ReserveFlashSaleUseCase reserveFlashSaleUseCase;
	private final GetActiveFlashSaleCampaignsUseCase getActiveFlashSaleCampaignsUseCase;

	public FlashSaleController(ReserveFlashSaleUseCase reserveFlashSaleUseCase,
			GetActiveFlashSaleCampaignsUseCase getActiveFlashSaleCampaignsUseCase) {
		this.reserveFlashSaleUseCase = reserveFlashSaleUseCase;
		this.getActiveFlashSaleCampaignsUseCase = getActiveFlashSaleCampaignsUseCase;
	}

	@PostMapping("/reserve")
	@PreAuthorize("hasRole('BUYER') or hasRole('ADMIN')")
	public ApiResponse<ReserveFlashSaleResponse> reserve(
			@Valid @RequestBody ReserveFlashSaleRequest request,
			@RequestHeader("Idempotency-Key") String idempotencyKey) {
		ReserveFlashSaleResult result = reserveFlashSaleUseCase.reserve(
				new ReserveFlashSaleCommand(
						request.productId(), JwtPrincipalUtil.currentUserId(), request.quantity(),
						idempotencyKey, requestHash(request)));
		return ApiResponse.ok(new ReserveFlashSaleResponse(
				result.reservationId(),
				result.status(),
				result.expiresAt()));
	}

	private static String requestHash(ReserveFlashSaleRequest request) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
					.digest((request.productId() + "\n" + request.quantity()).getBytes(StandardCharsets.UTF_8)));
		} catch (Exception exception) {
			throw new IllegalStateException("SHA-256 is unavailable", exception);
		}
	}

	@GetMapping("/stock/{productId}")
	public ApiResponse<StockResponse> stock(@PathVariable String productId) {
		return ApiResponse.ok(new StockResponse(productId, reserveFlashSaleUseCase.getStock(productId)));
	}

	@PostMapping("/release/{reservationId}")
	@PreAuthorize("hasRole('BUYER') or hasRole('ADMIN')")
	public ApiResponse<Void> release(@PathVariable String reservationId) {
		reserveFlashSaleUseCase.release(UUID.fromString(reservationId), JwtPrincipalUtil.currentUserId());
		return ApiResponse.ok(null);
	}

	@GetMapping("/active")
	public ApiResponse<List<ActiveFlashSaleCampaignResponse>> active() {
		List<ActiveFlashSaleCampaignResponse> campaigns = getActiveFlashSaleCampaignsUseCase.getActive().stream()
				.map(ActiveFlashSaleCampaignResponse::from)
				.toList();
		return ApiResponse.ok(campaigns);
	}
}
