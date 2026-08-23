package com.vnshop.invoiceservice.infrastructure.web;

import com.vnshop.invoiceservice.application.InvoiceService;
import com.vnshop.invoiceservice.application.gdt.InvoiceSubmissionService;
import com.vnshop.invoiceservice.domain.entity.Invoice;
import com.vnshop.invoiceservice.domain.entity.InvoiceStatus;
import com.vnshop.invoiceservice.infrastructure.config.JwtPrincipalUtil;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final InvoiceSubmissionService invoiceSubmissionService;

    /**
     * Returns the invoice for the given orderId.
     */
    @GetMapping("/{orderId}")
    @PreAuthorize("hasAnyRole('BUYER','SELLER','ADMIN')")
    public ResponseEntity<Invoice> getByOrderId(@PathVariable UUID orderId) {
        return authorizedInvoice(orderId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Lists invoices filtered by sellerId and optional status.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('SELLER','ADMIN')")
    public ResponseEntity<List<Invoice>> list(
            @RequestParam String sellerId,
            @RequestParam(required = false) InvoiceStatus status) {
        if (!JwtPrincipalUtil.hasRole("ADMIN") && !sellerId.equals(JwtPrincipalUtil.currentSellerId())) {
            throw forbidden();
        }
        List<Invoice> invoices = invoiceService.findBySeller(sellerId, status);
        return ResponseEntity.ok(invoices);
    }

    /**
     * Generates TKHDon XML for the invoice associated with the given orderId.
     * Validates against XSD, persists the XML payload on the invoice, and returns it.
     *
     * POST /api/v1/invoices/{orderId}/xml
     */
    @PostMapping(value = "/{orderId}/xml", produces = MediaType.APPLICATION_XML_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> generateXml(@PathVariable UUID orderId) {
        requireAdmin();
        String xml = invoiceService.generateXml(orderId);
        return ResponseEntity.ok(xml);
    }

    /**
     * Submits the invoice for the given orderId to the GDT API.
     * The invoice must already have an XML payload (generate via /{orderId}/xml first).
     *
     * POST /api/v1/invoices/{orderId}/submit
     */
    @PostMapping("/{orderId}/submit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Invoice> submit(@PathVariable UUID orderId) {
        requireAdmin();
        Invoice invoice = invoiceSubmissionService.submitToGdt(orderId);
        return ResponseEntity.ok(invoice);
    }

    /**
     * Returns the current GDT submission status for the invoice.
     *
     * GET /api/v1/invoices/{orderId}/gdt-status
     */
    @GetMapping("/{orderId}/gdt-status")
    @PreAuthorize("hasAnyRole('BUYER','SELLER','ADMIN')")
    public ResponseEntity<Map<String, Object>> gdtStatus(@PathVariable UUID orderId) {
        return authorizedInvoice(orderId)
                .map(inv -> ResponseEntity.ok(Map.<String, Object>of(
                        "orderId", inv.getOrderId(),
                        "status", inv.getStatus(),
                        "gdtInvoiceNumber", inv.getGdtInvoiceNumber() != null ? inv.getGdtInvoiceNumber() : "",
                        "gdtVerificationCode", inv.getGdtVerificationCode() != null ? inv.getGdtVerificationCode() : "",
                        "rejectionReason", inv.getRejectionReason() != null ? inv.getRejectionReason() : "",
                        "submittedAt", inv.getSubmittedAt() != null ? inv.getSubmittedAt().toString() : ""
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Resubmits a REJECTED invoice to the GDT API after admin correction.
     *
     * POST /api/v1/invoices/{orderId}/resubmit
     */
    @PostMapping("/{orderId}/resubmit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Invoice> resubmit(@PathVariable UUID orderId) {
        requireAdmin();
        Invoice invoice = invoiceSubmissionService.resubmitToGdt(orderId);
        return ResponseEntity.ok(invoice);
    }

    private Optional<Invoice> authorizedInvoice(UUID orderId) {
        Optional<Invoice> invoice = invoiceService.findByOrderId(orderId);
        if (invoice.isPresent() && !isCurrentOwner(invoice.get())) {
            throw forbidden();
        }
        return invoice;
    }

    private boolean isCurrentOwner(Invoice invoice) {
        return JwtPrincipalUtil.hasRole("ADMIN")
                || invoice.getSellerId().equals(JwtPrincipalUtil.currentUserId())
                || invoice.getBuyerId().equals(JwtPrincipalUtil.currentUserId());
    }

    private void requireAdmin() {
        if (!JwtPrincipalUtil.hasRole("ADMIN")) {
            throw forbidden();
        }
    }

    private static org.springframework.web.server.ResponseStatusException forbidden() {
        return new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN, "Invoice access denied");
    }
}
