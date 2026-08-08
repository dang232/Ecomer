package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import com.vnshop.userservice.domain.port.out.AdminSellerCursor;

import java.util.List;

public class ListPendingSellersUseCase {

    private final UserRepositoryPort userRepositoryPort;

    public ListPendingSellersUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = userRepositoryPort;
    }

    public List<SellerProfile> listPending() {
        return listPending(null);
    }

    public List<SellerProfile> listPending(String query) {
        return userRepositoryPort.findPendingSellers(query);
    }

    public List<SellerProfile> listPendingCursor(String query, AdminSellerCursor cursor, int limit) {
        return userRepositoryPort.findPendingSellersCursor(query, cursor, limit);
    }
}
