package com.vnshop.sellerfinanceservice.domain.port.out;

import java.util.List;
import java.util.Map;

/** Resolves public shop labels without coupling the finance domain to user-service. */
public interface SellerDirectoryPort {
    Map<String, String> lookup(List<String> sellerIds);
}
