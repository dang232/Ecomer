package com.vnshop.orderservice.infrastructure.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;
import java.util.Map;

/**
 * Routes readOnly=true transactions to a PostgreSQL read replica via AbstractRoutingDataSource.
 *
 * Set REPLICA_HOST to the replica's hostname. When REPLICA_HOST is absent or equals the
 * primary host, both lookup keys point to the same database — no code change required.
 */
@Configuration
@ConditionalOnProperty(
        name = "vnshop.datasource.read-replica.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class ReadReplicaDataSourceConfig {

    private enum DataSourceType { PRIMARY, REPLICA }

    @Value("${spring.datasource.url}")
    private String primaryUrl;

    @Value("${spring.datasource.username}")
    private String username;

    @Value("${spring.datasource.password}")
    private String password;

    @Value("${spring.datasource.hikari.maximum-pool-size:10}")
    private int maxPoolSize;

    @Value("${spring.datasource.hikari.minimum-idle:2}")
    private int minIdle;

    @Value("${spring.datasource.hikari.connection-timeout:3000}")
    private long connectionTimeout;

    @Value("${spring.datasource.hikari.idle-timeout:600000}")
    private long idleTimeout;

    @Value("${spring.datasource.hikari.max-lifetime:1800000}")
    private long maxLifetime;

    /** Defaults to primary host when not set, making routing a no-op for local dev. */
    @Value("${REPLICA_HOST:#{null}}")
    private String replicaHost;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariDataSource primary = buildDataSource(primaryUrl, "order-svc-primary");
        HikariDataSource replica = buildDataSource(replicaUrl(), "order-svc-replica");

        AbstractRoutingDataSource routing = new AbstractRoutingDataSource() {
            @Override
            protected Object determineCurrentLookupKey() {
                return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
                        ? DataSourceType.REPLICA
                        : DataSourceType.PRIMARY;
            }
        };
        routing.setTargetDataSources(Map.of(
                DataSourceType.PRIMARY, primary,
                DataSourceType.REPLICA, replica
        ));
        routing.setDefaultTargetDataSource(primary);
        routing.afterPropertiesSet();
        return routing;
    }

    private String replicaUrl() {
        if (replicaHost == null || replicaHost.isBlank()) {
            return primaryUrl;
        }
        // Replace hostname in jdbc:postgresql://host:port/db without touching port or path
        return primaryUrl.replaceFirst("//[^:/]+", "//" + replicaHost);
    }

    private HikariDataSource buildDataSource(String url, String poolName) {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        ds.setPoolName(poolName);
        ds.setMaximumPoolSize(maxPoolSize);
        ds.setMinimumIdle(minIdle);
        ds.setConnectionTimeout(connectionTimeout);
        ds.setIdleTimeout(idleTimeout);
        ds.setMaxLifetime(maxLifetime);
        return ds;
    }
}
