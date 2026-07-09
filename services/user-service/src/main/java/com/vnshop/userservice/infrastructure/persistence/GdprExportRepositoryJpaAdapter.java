package com.vnshop.userservice.infrastructure.persistence;

import com.vnshop.userservice.domain.GdprExportRequest;
import com.vnshop.userservice.domain.GdprExportStatus;
import com.vnshop.userservice.domain.port.out.GdprExportRepositoryPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Repository
public class GdprExportRepositoryJpaAdapter implements GdprExportRepositoryPort {

    private final JdbcTemplate jdbcTemplate;

    public GdprExportRepositoryJpaAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void save(GdprExportRequest request) {
        jdbcTemplate.update(
                "INSERT INTO user_svc.gdpr_export_requests " +
                "(request_id, user_id, status, fragments, missing_services, created_at, completed_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT (request_id) DO UPDATE SET " +
                "status = EXCLUDED.status, fragments = EXCLUDED.fragments, " +
                "missing_services = EXCLUDED.missing_services, completed_at = EXCLUDED.completed_at",
                request.getRequestId(),
                request.getUserId(),
                request.getStatus().name(),
                serializeMap(request.getFragments()),
                serializeSet(request.getMissingServices()),
                Timestamp.from(request.getCreatedAt()),
                request.getCompletedAt() == null ? null : Timestamp.from(request.getCompletedAt())
        );
    }

    @Override
    public Optional<GdprExportRequest> findByRequestId(String requestId) {
        var results = jdbcTemplate.query(
                "SELECT request_id, user_id, status, fragments, missing_services, created_at, completed_at " +
                "FROM user_svc.gdpr_export_requests WHERE request_id = ?",
                (rs, rowNum) -> mapRow(rs),
                requestId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    @Override
    public Optional<GdprExportRequest> findLatestByUserId(String userId) {
        var results = jdbcTemplate.query(
                "SELECT request_id, user_id, status, fragments, missing_services, created_at, completed_at " +
                "FROM user_svc.gdpr_export_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                (rs, rowNum) -> mapRow(rs),
                userId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    @Override
    public boolean hasRecentExport(String userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_svc.gdpr_export_requests " +
                "WHERE user_id = ? AND created_at > NOW() - INTERVAL '1 hour'",
                Integer.class,
                userId);
        return count != null && count > 0;
    }

    private GdprExportRequest mapRow(ResultSet rs) throws SQLException {
        String requestId = rs.getString("request_id");
        String userId = rs.getString("user_id");
        Instant createdAt = rs.getTimestamp("created_at").toInstant();
        GdprExportStatus status = GdprExportStatus.valueOf(rs.getString("status"));
        Map<String, String> fragments = deserializeMap(rs.getString("fragments"));
        Set<String> missingServices = deserializeSet(rs.getString("missing_services"));
        Timestamp completedAtTs = rs.getTimestamp("completed_at");
        Instant completedAt = completedAtTs == null ? null : completedAtTs.toInstant();
        return new GdprExportRequest(requestId, userId, createdAt, status, fragments, missingServices, completedAt);
    }

    private String serializeMap(Map<String, String> map) {
        if (map == null || map.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        map.forEach((k, v) -> sb.append(k).append("=").append(v).append("|"));
        return sb.toString();
    }

    private Map<String, String> deserializeMap(String s) {
        Map<String, String> map = new HashMap<>();
        if (s == null || s.isBlank()) return map;
        for (String entry : s.split("\\|")) {
            int idx = entry.indexOf('=');
            if (idx > 0) {
                map.put(entry.substring(0, idx), entry.substring(idx + 1));
            }
        }
        return map;
    }

    private String serializeSet(Set<String> set) {
        if (set == null || set.isEmpty()) return "";
        return String.join(",", set);
    }

    private Set<String> deserializeSet(String s) {
        if (s == null || s.isBlank()) return new HashSet<>();
        return new HashSet<>(Arrays.asList(s.split(",")));
    }
}
