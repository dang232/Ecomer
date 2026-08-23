package com.vnshop.invoiceservice.application;

import com.vnshop.invoiceservice.application.xml.InvoiceXmlGenerator;
import com.vnshop.invoiceservice.domain.entity.Invoice;
import com.vnshop.invoiceservice.domain.entity.InvoiceStatus;
import com.vnshop.invoiceservice.domain.repository.InvoiceRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceXmlGenerator invoiceXmlGenerator;

    /**
     * Creates a DRAFT invoice from an order.confirmed event payload.
     * Idempotent: if an invoice already exists for the orderId, returns the existing one.
     *
     * @param taxDeductionAmount pre-calculated deduction amount for authorized sellers; null otherwise
     */
    @Transactional
    public Invoice createDraftInvoice(UUID orderId, String sellerId, String buyerId, String items, String vatBreakdown,
            String buyerTaxCode, BigDecimal taxDeductionAmount) {
        Optional<Invoice> existing = invoiceRepository.findByOrderId(orderId);
        if (existing.isPresent()) {
            log.debug("Invoice already exists for orderId={} — idempotent no-op", orderId);
            return existing.get();
        }

        Instant now = Instant.now();
        Invoice invoice = Invoice.builder()
                .orderId(orderId)
                .sellerId(sellerId)
                .buyerId(buyerId)
                .buyerTaxCode(buyerTaxCode)
                .items(items)
                .vatBreakdown(vatBreakdown)
                .status(InvoiceStatus.DRAFT)
                .taxDeductionAmount(taxDeductionAmount)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Invoice saved = invoiceRepository.save(invoice);
        log.info("Created DRAFT invoice id={} for orderId={} sellerId={} taxDeductionAmount={}",
                saved.getId(), orderId, sellerId, taxDeductionAmount);
        return saved;
    }

    @Transactional(readOnly = true)
    public Optional<Invoice> findByOrderId(UUID orderId) {
        return invoiceRepository.findByOrderId(orderId);
    }

    @Transactional(readOnly = true)
    public List<Invoice> findBySeller(String sellerId, InvoiceStatus status) {
        if (status != null) {
            return invoiceRepository.findBySellerIdAndStatus(sellerId, status);
        }
        return invoiceRepository.findBySellerId(sellerId);
    }

    /**
     * Generates (or regenerates) the TKHDon XML for the invoice associated with the given orderId.
     * Validates the XML against the TKHDon XSD schema and persists it on the invoice entity.
     *
     * @param orderId the order whose invoice should be serialised to XML
     * @return validated XML string
     * @throws jakarta.persistence.EntityNotFoundException if no invoice exists for the orderId
     */
    @Transactional
    public String generateXml(UUID orderId) {
        Invoice invoice = invoiceRepository.findByOrderId(orderId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException(
                        "No invoice found for orderId=" + orderId));

        String xml = invoiceXmlGenerator.generate(invoice);
        invoice.setXmlPayload(xml);
        invoice.setUpdatedAt(Instant.now());
        invoiceRepository.save(invoice);

        log.info("Generated TKHDon XML for invoiceId={} orderId={}", invoice.getId(), orderId);
        return xml;
    }
}
