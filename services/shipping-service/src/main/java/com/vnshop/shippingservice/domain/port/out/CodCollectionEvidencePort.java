package com.vnshop.shippingservice.domain.port.out;

import com.vnshop.shippingservice.domain.model.CodCollectionEvidence;

import java.util.Optional;

public interface CodCollectionEvidencePort {
    CodCollectionEvidence saveExpected(CodCollectionEvidence evidence);

    Optional<CodCollectionEvidence> findExpected(String carrier, String trackingCode);

    CodCollectionEvidence saveCollected(CodCollectionEvidence evidence);

    static CodCollectionEvidencePort noop() {
        return new CodCollectionEvidencePort() {
            @Override public CodCollectionEvidence saveExpected(CodCollectionEvidence evidence) { return evidence; }
            @Override public Optional<CodCollectionEvidence> findExpected(String carrier, String trackingCode) { return Optional.empty(); }
            @Override public CodCollectionEvidence saveCollected(CodCollectionEvidence evidence) { return evidence; }
        };
    }
}
