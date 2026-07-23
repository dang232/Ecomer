package com.vnshop.shippingservice.infrastructure.persistence;

import com.vnshop.shippingservice.domain.model.CodCollectionEvidence;
import com.vnshop.shippingservice.domain.port.out.CodCollectionEvidencePort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
@ConditionalOnMissingBean(JdbcTemplate.class)
public class InMemoryCodCollectionEvidenceAdapter implements CodCollectionEvidencePort {
    private final Map<String, CodCollectionEvidence> byTracking = new ConcurrentHashMap<>();
    private final Map<String, CodCollectionEvidence> byEvent = new ConcurrentHashMap<>();

    @Override
    public CodCollectionEvidence saveExpected(CodCollectionEvidence evidence) {
        byTracking.put(key(evidence.carrier(), evidence.trackingCode()), evidence);
        return evidence;
    }

    @Override
    public Optional<CodCollectionEvidence> findExpected(String carrier, String trackingCode) {
        return Optional.ofNullable(byTracking.get(key(carrier, trackingCode)));
    }

    @Override
    public CodCollectionEvidence saveCollected(CodCollectionEvidence evidence) {
        byTracking.put(key(evidence.carrier(), evidence.trackingCode()), evidence);
        byEvent.put(key(evidence.carrier(), evidence.carrierEventId()), evidence);
        return evidence;
    }

    private static String key(String carrier, String value) {
        return carrier + ":" + value;
    }
}
