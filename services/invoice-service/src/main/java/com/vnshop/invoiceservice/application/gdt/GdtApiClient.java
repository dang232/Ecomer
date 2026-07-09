package com.vnshop.invoiceservice.application.gdt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/**
 * REST client for the GDT (General Department of Taxation) e-invoice transmission API.
 *
 * <p>Authentication uses a bearer token configured via {@code GDT_API_TOKEN}.
 * Digital certificate signing is a placeholder — production use requires a valid
 * HSM-backed certificate issued by a licensed CA.</p>
 */
@Slf4j
@Component
public class GdtApiClient {

    private static final String SUBMIT_PATH = "/invoices/submit";
    private static final String CIRCUIT_BREAKER_NAME = "gdtApi";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiToken;

    public GdtApiClient(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            @Value("${gdt.api.url:https://hoadondientu-sandbox.gdt.gov.vn/api/v1}") String baseUrl,
            @Value("${gdt.api.token:}") String apiToken) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl;
        this.apiToken = apiToken;
    }

    /**
     * Submits a signed TKHDon XML payload to the GDT API.
     * Uses circuit breaker to prevent cascade failures when GDT API is unavailable.
     *
     * @param xmlPayload validated TKHDon XML string
     * @return {@link GdtSubmissionResult} indicating acceptance or rejection
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "submitInvoiceFallback")
    public GdtSubmissionResult submitInvoice(String xmlPayload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_XML);
        if (!apiToken.isBlank()) {
            headers.setBearerAuth(apiToken);
        }

        // Placeholder: production must attach a digital certificate signature here.
        HttpEntity<String> request = new HttpEntity<>(xmlPayload, headers);

        try {
            ResponseEntity<String> response =
                    restTemplate.postForEntity(baseUrl + SUBMIT_PATH, request, String.class);

            return parseResponse(response.getStatusCode().value(), response.getBody());

        } catch (HttpClientErrorException ex) {
            log.warn("GDT API returned HTTP {}: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            return parseResponse(ex.getStatusCode().value(), ex.getResponseBodyAsString());
        } catch (Exception ex) {
            log.error("GDT API call failed unexpectedly", ex);
            return GdtSubmissionResult.rejected("GDT API unreachable: " + ex.getMessage());
        }
    }

    private GdtSubmissionResult parseResponse(int statusCode, String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            if (statusCode == HttpStatus.OK.value() || statusCode == HttpStatus.CREATED.value()) {
                String invoiceNumber = root.path("invoiceNumber").asText(null);
                String verificationCode = root.path("verificationCode").asText(null);
                log.info("GDT accepted invoice: invoiceNumber={} verificationCode={}", invoiceNumber, verificationCode);
                return GdtSubmissionResult.accepted(invoiceNumber, verificationCode);
            } else {
                String reason = root.path("errorMessage").asText(
                        root.path("message").asText("HTTP " + statusCode));
                log.warn("GDT rejected invoice: {}", reason);
                return GdtSubmissionResult.rejected(reason);
            }
        } catch (Exception parseEx) {
            log.error("Failed to parse GDT response body: {}", body, parseEx);
            return GdtSubmissionResult.rejected("Unparseable GDT response (HTTP " + statusCode + ")");
        }
    }

    /**
     * Fallback method when circuit breaker is open or call fails.
     * Returns a rejected result indicating temporary unavailability.
     */
    private GdtSubmissionResult submitInvoiceFallback(String xmlPayload, Throwable throwable) {
        log.error("GDT API circuit breaker open or call failed: {}", throwable.getMessage());
        return GdtSubmissionResult.rejected("GDT service temporarily unavailable. Please try again later.");
    }
}
