package com.vnshop.paymentservice.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface PaymentCallbackLogSpringDataRepository extends JpaRepository<PaymentCallbackLogJpaEntity, String> {
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "INSERT INTO payment_svc.payment_callback_logs "
            + "(callback_id, provider, event_id, payload_hash, signature_hash, request_headers, request_body, received_at, processing_status, duplicate_replay) "
            + "VALUES (:callbackId, :provider, :eventId, :payloadHash, :signatureHash, :headers, :body, :receivedAt, :status, :duplicate) "
            + "ON CONFLICT (provider, event_id, payload_hash, signature_hash) DO NOTHING", nativeQuery = true)
    int claim(@org.springframework.data.repository.query.Param("callbackId") java.util.UUID callbackId,
              @org.springframework.data.repository.query.Param("provider") String provider,
              @org.springframework.data.repository.query.Param("eventId") String eventId,
              @org.springframework.data.repository.query.Param("payloadHash") String payloadHash,
              @org.springframework.data.repository.query.Param("signatureHash") String signatureHash,
              @org.springframework.data.repository.query.Param("headers") String headers,
              @org.springframework.data.repository.query.Param("body") String body,
              @org.springframework.data.repository.query.Param("receivedAt") java.time.Instant receivedAt,
              @org.springframework.data.repository.query.Param("status") String status,
              @org.springframework.data.repository.query.Param("duplicate") boolean duplicate);

    Optional<PaymentCallbackLogJpaEntity> findFirstByProviderAndEventIdAndPayloadHashAndSignatureHashAndProcessingStatusIn(String provider, String eventId, String payloadHash, String signatureHash, List<String> processingStatuses);

    Optional<PaymentCallbackLogJpaEntity> findFirstByProviderAndPayloadHashAndSignatureHashAndProcessingStatusIn(String provider, String payloadHash, String signatureHash, List<String> processingStatuses);
}
