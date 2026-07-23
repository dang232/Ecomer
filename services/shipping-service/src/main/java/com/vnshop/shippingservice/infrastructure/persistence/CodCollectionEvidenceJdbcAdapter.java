package com.vnshop.shippingservice.infrastructure.persistence;

import com.vnshop.shippingservice.domain.model.CodCollectionEvidence;
import com.vnshop.shippingservice.domain.port.out.CodCollectionEvidencePort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class CodCollectionEvidenceJdbcAdapter implements CodCollectionEvidencePort {
    private final JdbcTemplate jdbcTemplate;

    public CodCollectionEvidenceJdbcAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public CodCollectionEvidence saveExpected(CodCollectionEvidence evidence) {
        jdbcTemplate.update("""
                INSERT INTO shipping_svc.cod_collection_evidence
                    (evidence_id, shipment_id, carrier, order_id, tracking_code,
                     expected_cod_amount, currency, evidence_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'EXPECTED', now(), now())
                ON CONFLICT (carrier, tracking_code) DO UPDATE SET
                    shipment_id = EXCLUDED.shipment_id,
                    order_id = EXCLUDED.order_id,
                    expected_cod_amount = EXCLUDED.expected_cod_amount,
                    currency = EXCLUDED.currency,
                    updated_at = now()
                WHERE shipping_svc.cod_collection_evidence.evidence_status <> 'VERIFIED'
                """,
                evidence.evidenceId(), evidence.shipmentId(), evidence.carrier(), evidence.orderId(),
                evidence.trackingCode(), evidence.expectedCodAmount(), evidence.currency());
        return evidence;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CodCollectionEvidence> findExpected(String carrier, String trackingCode) {
        List<CodCollectionEvidence> rows = jdbcTemplate.query("""
                SELECT evidence_id, shipment_id, collection_id, carrier_event_id, order_id, carrier,
                       tracking_code, expected_cod_amount, collected_cod_amount, currency,
                       provider_timestamp, evidence_status
                  FROM shipping_svc.cod_collection_evidence
                 WHERE carrier = ? AND tracking_code = ?
                """, this::map, carrier, trackingCode);
        return rows.stream().findFirst();
    }

    @Override
    @Transactional
    public CodCollectionEvidence saveCollected(CodCollectionEvidence evidence) {
        jdbcTemplate.update("""
                INSERT INTO shipping_svc.cod_collection_evidence
                    (evidence_id, shipment_id, collection_id, carrier_event_id, order_id, carrier,
                     tracking_code, expected_cod_amount, collected_cod_amount, currency,
                     provider_timestamp, evidence_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())
                ON CONFLICT (carrier, tracking_code) DO UPDATE SET
                    shipment_id = EXCLUDED.shipment_id,
                    collection_id = EXCLUDED.collection_id,
                    carrier_event_id = EXCLUDED.carrier_event_id,
                    order_id = EXCLUDED.order_id,
                    expected_cod_amount = EXCLUDED.expected_cod_amount,
                    collected_cod_amount = EXCLUDED.collected_cod_amount,
                    currency = EXCLUDED.currency,
                    provider_timestamp = EXCLUDED.provider_timestamp,
                    evidence_status = EXCLUDED.evidence_status,
                    updated_at = now()
                """,
                evidence.evidenceId(), evidence.shipmentId(), evidence.collectionId(), evidence.carrierEventId(),
                evidence.orderId(), evidence.carrier(), evidence.trackingCode(), evidence.expectedCodAmount(),
                evidence.collectedCodAmount(), evidence.currency(), evidence.providerTimestamp(), evidence.status().name());
        return evidence;
    }

    private CodCollectionEvidence map(ResultSet rs, int rowNum) throws SQLException {
        return new CodCollectionEvidence(
                rs.getObject("evidence_id", UUID.class), rs.getObject("shipment_id", UUID.class),
                rs.getObject("collection_id", UUID.class), rs.getString("carrier_event_id"),
                rs.getString("order_id"), rs.getString("carrier"), rs.getString("tracking_code"),
                rs.getBigDecimal("expected_cod_amount"), rs.getBigDecimal("collected_cod_amount"),
                rs.getString("currency"), rs.getObject("provider_timestamp", Instant.class),
                CodCollectionEvidence.EvidenceStatus.valueOf(rs.getString("evidence_status")));
    }
}
