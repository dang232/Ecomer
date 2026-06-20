package com.vnshop.userservice.infrastructure.persistence;

import com.vnshop.userservice.domain.WishlistItem;
import com.vnshop.userservice.domain.port.out.WishlistRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class WishlistJpaAdapter implements WishlistRepositoryPort {
    private final WishlistSpringDataRepository repo;

    public WishlistJpaAdapter(WishlistSpringDataRepository repo) {
        this.repo = repo;
    }

    @Override
    public List<WishlistItem> findByKeycloakId(String keycloakId) {
        return repo.findByIdKeycloakIdOrderByCreatedAtDesc(keycloakId).stream()
                .map(e -> new WishlistItem(e.getId().getKeycloakId(), e.getId().getProductId(), e.getCreatedAt()))
                .toList();
    }

    @Override
    public boolean add(WishlistItem item) {
        if (exists(item.keycloakId(), item.productId())) {
            return false;
        }
        repo.save(new WishlistItemJpaEntity(item.keycloakId(), item.productId(), item.createdAt()));
        return true;
    }

    @Override
    public boolean remove(String keycloakId, String productId) {
        return repo.deleteByKeycloakIdAndProductId(keycloakId, productId) > 0;
    }

    @Override
    public int clear(String keycloakId) {
        return repo.deleteAllByKeycloakId(keycloakId);
    }

    @Override
    public boolean exists(String keycloakId, String productId) {
        return repo.existsByIdKeycloakIdAndIdProductId(keycloakId, productId);
    }

    @Override
    public int countByKeycloakId(String keycloakId) {
        return repo.countByIdKeycloakId(keycloakId);
    }
}
