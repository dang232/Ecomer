package com.vnshop.shippingservice.infrastructure.persistence;

import com.vnshop.shippingservice.domain.model.CarrierCode;
import com.vnshop.shippingservice.domain.model.ShippingLabelRecord;
import com.vnshop.shippingservice.domain.port.out.ShippingLabelRepositoryPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class ShippingLabelJdbcAdapter implements ShippingLabelRepositoryPort {
    private final JdbcTemplate jdbcTemplate;

    public ShippingLabelJdbcAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public ShippingLabelRecord save(ShippingLabelRecord label) {
        jdbcTemplate.update("""
                INSERT INTO shipping_svc.shipping_labels
                    (label_id, order_id, carrier, tracking_code, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, now(), now())
                ON CONFLICT (carrier, tracking_code) DO UPDATE SET
                    order_id = EXCLUDED.order_id,
                    status = EXCLUDED.status,
                    updated_at = now()
                """,
                label.labelId(), label.orderId(), label.carrier().name(), label.trackingCode(), label.status().name());
        return label;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShippingLabelRecord> findCreatedByOrderId(String orderId) {
        return jdbcTemplate.query("""
                SELECT label_id, order_id, carrier, tracking_code, status
                  FROM shipping_svc.shipping_labels
                 WHERE order_id = ? AND status = 'CREATED'
                 ORDER BY created_at, label_id
                """, this::map, orderId);
    }

    @Override
    @Transactional
    public void markCancelled(String orderId, String trackingCode) {
        jdbcTemplate.update("""
                UPDATE shipping_svc.shipping_labels
                   SET status = 'CANCELLED', updated_at = now()
                 WHERE order_id = ? AND tracking_code = ? AND status = 'CREATED'
                """, orderId, trackingCode);
    }

    private ShippingLabelRecord map(ResultSet resultSet, int rowNumber) throws SQLException {
        return new ShippingLabelRecord(
                resultSet.getObject("label_id", UUID.class),
                resultSet.getString("order_id"),
                CarrierCode.valueOf(resultSet.getString("carrier")),
                resultSet.getString("tracking_code"),
                ShippingLabelRecord.Status.valueOf(resultSet.getString("status")));
    }
}
