package com.vnshop.orderservice.integration;

import java.util.ArrayList;
import java.util.List;
import org.hibernate.resource.jdbc.spi.StatementInspector;

public final class CursorSqlCapture implements StatementInspector {
    private static final ThreadLocal<List<String>> STATEMENTS = ThreadLocal.withInitial(ArrayList::new);

    public CursorSqlCapture() {
    }

    @Override
    public String inspect(String sql) {
        STATEMENTS.get().add(sql);
        return sql;
    }

    static void clear() {
        STATEMENTS.remove();
    }

    static List<String> statements() {
        return new ArrayList<>(STATEMENTS.get());
    }
}
