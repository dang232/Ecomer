package com.vnshop.invoiceservice.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "order_id", nullable = false, unique = true)
    private UUID orderId;

    @Column(name = "seller_id", nullable = false)
    private String sellerId;

    @Column(name = "buyer_id", nullable = false)
    private String buyerId;

    @Column(name = "buyer_tax_code")
    private String buyerTaxCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "items", columnDefinition = "jsonb")
    private String items;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "vat_breakdown", columnDefinition = "jsonb")
    private String vatBreakdown;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private InvoiceStatus status;

    @Column(name = "gdt_invoice_number")
    private String gdtInvoiceNumber;

    @Column(name = "xml_payload", columnDefinition = "TEXT")
    private String xmlPayload;

    @Column(name = "gdt_verification_code")
    private String gdtVerificationCode;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "gdt_response_json", columnDefinition = "TEXT")
    private String gdtResponseJson;

    @Column(name = "tax_deduction_amount", precision = 19, scale = 4)
    private BigDecimal taxDeductionAmount;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
