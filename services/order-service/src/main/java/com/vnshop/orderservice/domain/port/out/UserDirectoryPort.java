package com.vnshop.orderservice.domain.port.out;

import java.util.Map;
import java.util.Set;

/** Reads public buyer/shop display projections from user-service. */
public interface UserDirectoryPort {
    DirectorySnapshot lookup(Set<String> buyerIds, Set<String> sellerIds);

    record DirectorySnapshot(Map<String, String> buyerNames, Map<String, String> sellerNames) {
        public DirectorySnapshot {
            buyerNames = buyerNames == null ? Map.of() : Map.copyOf(buyerNames);
            sellerNames = sellerNames == null ? Map.of() : Map.copyOf(sellerNames);
        }

        public static DirectorySnapshot empty() {
            return new DirectorySnapshot(Map.of(), Map.of());
        }
    }
}
