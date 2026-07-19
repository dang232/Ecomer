package com.vnshop.orderservice.infrastructure.audit;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity
@Table(schema = "order_svc", name = "audit_log")
public class AuditLogJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant timestamp;

    private String userId;

    private String userRole;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(nullable = false, length = 100)
    private String resourceType;

    private String resourceId;

    // columnDefinition = "jsonb" only affects schema generation (per HANDOFF
    // gotcha); @JdbcTypeCode(SqlTypes.JSON) tells Hibernate to bind the
    // String as jsonb so Postgres doesn't reject the cast.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String details;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 100)
    private String correlationId;

    @Column(nullable = false, length = 50)
    private String serviceName;

    protected AuditLogJpaEntity() {}

    public AuditLogJpaEntity(String userId, String userRole, String action,
                              String resourceType, String resourceId,
                              String details, String ipAddress,
                              String correlationId) {
        this.timestamp = Instant.now();
        this.userId = userId;
        this.userRole = userRole;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.details = details;
        this.ipAddress = ipAddress;
        this.correlationId = correlationId;
        this.serviceName = "order-service";
    }

    public Long getId() { return id; }
    public Instant getTimestamp() { return timestamp; }
    public String getUserId() { return userId; }
    public String getUserRole() { return userRole; }
    public String getAction() { return action; }
    public String getResourceType() { return resourceType; }
    public String getResourceId() { return resourceId; }
    public String getDetails() { return details; }
    public String getIpAddress() { return ipAddress; }
    public String getCorrelationId() { return correlationId; }
    public String getServiceName() { return serviceName; }
}
