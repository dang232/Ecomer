package com.vnshop.orderservice.integration;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.hibernate.resource.jdbc.spi.StatementInspector;

public final class CursorSqlCapture implements StatementInspector {
    private static final CopyOnWriteArrayList<String> STATEMENTS = new CopyOnWriteArrayList<>();

    public CursorSqlCapture() {
    }

    @Override
    public String inspect(String sql) {
        STATEMENTS.add(sql);
        return sql;
    }

    static void clear() {
        STATEMENTS.clear();
    }

    static List<String> statements() {
        return new ArrayList<>(STATEMENTS);
    }
}
