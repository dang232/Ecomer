package com.vnshop.invoiceservice;

import com.vnshop.invoiceservice.application.InvoiceService;
import com.vnshop.invoiceservice.application.gdt.InvoiceSubmissionService;
import com.vnshop.invoiceservice.domain.entity.Invoice;
import com.vnshop.invoiceservice.infrastructure.web.InvoiceController;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class InvoiceControllerTest {
    private static final UUID ORDER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void sellerCannotReadAnotherSellerInvoiceByOrderId() throws Exception {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceSubmissionService submissionService = mock(InvoiceSubmissionService.class);
        when(invoiceService.findByOrderId(ORDER_ID)).thenReturn(java.util.Optional.of(invoice("seller-a", "buyer-a")));
        authenticateAs("seller-b", "SELLER");

        mvc(invoiceService, submissionService).perform(get("/api/v1/invoices/{orderId}", ORDER_ID))
                .andExpect(status().isForbidden());

        verify(invoiceService).findByOrderId(ORDER_ID);
    }

    @Test
    void sellerCannotListAnotherSellerInvoices() throws Exception {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceSubmissionService submissionService = mock(InvoiceSubmissionService.class);
        authenticateAs("seller-b", "SELLER");

        mvc(invoiceService, submissionService).perform(get("/api/v1/invoices")
                        .param("sellerId", "seller-a"))
                .andExpect(status().isForbidden());

        verify(invoiceService, never()).findBySeller(any(), any());
    }

    @Test
    void buyerCanReadOwnInvoiceByOrderId() throws Exception {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceSubmissionService submissionService = mock(InvoiceSubmissionService.class);
        when(invoiceService.findByOrderId(ORDER_ID)).thenReturn(java.util.Optional.of(invoice("seller-a", "buyer-a")));
        authenticateAs("buyer-a", "BUYER");

        mvc(invoiceService, submissionService).perform(get("/api/v1/invoices/{orderId}", ORDER_ID))
                .andExpect(status().isOk());
    }

    @Test
    void buyerCannotReadAnotherBuyerInvoiceByOrderId() throws Exception {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceSubmissionService submissionService = mock(InvoiceSubmissionService.class);
        when(invoiceService.findByOrderId(ORDER_ID)).thenReturn(java.util.Optional.of(invoice("seller-a", "buyer-a")));
        authenticateAs("buyer-b", "BUYER");

        mvc(invoiceService, submissionService).perform(get("/api/v1/invoices/{orderId}", ORDER_ID))
                .andExpect(status().isForbidden());
    }

    @Test
    void sellerCannotGenerateXmlForAnotherSellerInvoice() throws Exception {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceSubmissionService submissionService = mock(InvoiceSubmissionService.class);
        when(invoiceService.findByOrderId(ORDER_ID)).thenReturn(java.util.Optional.of(invoice("seller-a", "buyer-a")));
        authenticateAs("seller-b", "SELLER");

        mvc(invoiceService, submissionService).perform(post("/api/v1/invoices/{orderId}/xml", ORDER_ID))
                .andExpect(status().isForbidden());

        verify(invoiceService, never()).generateXml(ORDER_ID);
    }

    @Test
    void sellerCannotReadAnotherSellerGdtStatus() throws Exception {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceSubmissionService submissionService = mock(InvoiceSubmissionService.class);
        when(invoiceService.findByOrderId(ORDER_ID)).thenReturn(java.util.Optional.of(invoice("seller-a", "buyer-a")));
        authenticateAs("seller-b", "SELLER");

        mvc(invoiceService, submissionService).perform(get("/api/v1/invoices/{orderId}/gdt-status", ORDER_ID))
                .andExpect(status().isForbidden());
    }

    private MockMvc mvc(InvoiceService invoiceService, InvoiceSubmissionService submissionService) {
        return MockMvcBuilders.standaloneSetup(new InvoiceController(invoiceService, submissionService)).build();
    }

    private static void authenticateAs(String subject, String role) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", subject)
                .claim("realm_access", Map.of("roles", List.of(role)))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private static Invoice invoice(String sellerId, String buyerId) {
        return Invoice.builder()
                .id(UUID.randomUUID())
                .orderId(ORDER_ID)
                .sellerId(sellerId)
                .buyerId(buyerId)
                .build();
    }
}
