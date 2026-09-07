package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.application.ledger.LedgerService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "payment.vnpay.enabled", havingValue = "true")
public class VnpayGateway {
    private static final DateTimeFormatter VNPAY_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final VnpayProperties properties;
    private final VnpaySigner signer;
    private final LedgerService ledgerService;
    private final Clock clock;

    @Autowired
    public VnpayGateway(VnpayProperties properties, LedgerService ledgerService) {
        this(properties, ledgerService, Clock.systemDefaultZone());
    }

    VnpayGateway(VnpayProperties properties, LedgerService ledgerService, Clock clock) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
        this.signer = new VnpaySigner(properties.hashSecret());
        this.ledgerService = Objects.requireNonNull(ledgerService, "ledgerService is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        requireNonBlank(properties.tmnCode(), "VNPay terminal code is required");
        requireNonBlank(properties.returnUrl(), "VNPay return URL is required");
        requireNonBlank(properties.ipnUrl(), "VNPay IPN URL is required");
    }

    public String createPaymentUrl(Payment payment, String clientIp) {
        Map<String, String> parameters = basePaymentParameters(payment, clientIp);
        parameters.put("vnp_SecureHash", signer.sign(parameters));
        return UriComponentsBuilder.fromUriString(properties.payUrl())
                .query(signer.canonicalQuery(parameters, false))
                .build(true)
                .toUriString();
    }

    public VnpayVerification verify(Map<String, String> parameters) {
        String receivedHash = parameters.get("vnp_SecureHash");
        boolean validSignature = signer.verify(parameters, receivedHash);
        String responseCode = parameters.get("vnp_ResponseCode");
        String transactionStatus = parameters.get("vnp_TransactionStatus");
        PaymentStatus status = validSignature && "00".equals(responseCode) && "00".equals(transactionStatus)
                ? PaymentStatus.COMPLETED
                : PaymentStatus.FAILED;
        BigDecimal amount = parseAmount(parameters.get("vnp_Amount"));
        return new VnpayVerification(validSignature, status, parameters.get("vnp_TxnRef"), parameters.get("vnp_TransactionNo"), responseCode, transactionStatus, amount);
    }

    private BigDecimal parseAmount(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw).movePointLeft(2);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Map<String, String> basePaymentParameters(Payment payment, String clientIp) {
        LocalDateTime createDate = LocalDateTime.now(clock);
        LocalDateTime expireDate = createDate.plusMinutes(properties.expireMinutes());
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("vnp_Version", properties.version());
        parameters.put("vnp_Command", properties.command());
        parameters.put("vnp_TmnCode", properties.tmnCode());
        parameters.put("vnp_Amount", toVnpayAmount(payment.amount()));
        parameters.put("vnp_CurrCode", properties.currency());
        parameters.put("vnp_TxnRef", payment.paymentId().toString());
        parameters.put("vnp_OrderInfo", "Payment for order " + payment.orderId());
        parameters.put("vnp_OrderType", properties.orderType());
        parameters.put("vnp_Locale", properties.locale());
        parameters.put("vnp_ReturnUrl", properties.returnUrl());
        parameters.put("vnp_IpnUrl", properties.ipnUrl());
        parameters.put("vnp_IpAddr", clientIp == null || clientIp.isBlank() ? "0.0.0.0" : clientIp);
        parameters.put("vnp_CreateDate", createDate.format(VNPAY_TIME));
        parameters.put("vnp_ExpireDate", expireDate.format(VNPAY_TIME));
        return parameters;
    }

    private String toVnpayAmount(BigDecimal amount) {
        return amount.multiply(new BigDecimal("100")).setScale(0, RoundingMode.UNNECESSARY).toPlainString();
    }

    private static void requireNonBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    public record VnpayVerification(
            boolean validSignature,
            PaymentStatus status,
            String paymentId,
            String transactionNo,
            String responseCode,
            String transactionStatus,
            BigDecimal amount
    ) {
    }
}
