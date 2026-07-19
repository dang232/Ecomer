package com.vnshop.recommendationsservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class CoPurchaseAggregatorTest {

    private CoPurchasePort coPurchasePort;
    private ProcessedOrderPort processedOrderPort;
    private InMemoryCoPurchaseStore store;

    @BeforeEach
    void setUp() {
        coPurchasePort = Mockito.mock(CoPurchasePort.class);
        processedOrderPort = Mockito.mock(ProcessedOrderPort.class);
        store = new InMemoryCoPurchaseStore();
        when(coPurchasePort.find(any(), any())).thenAnswer(inv ->
                Optional.ofNullable(store.get(inv.getArgument(0), inv.getArgument(1))));
        when(coPurchasePort.save(any())).thenAnswer(inv -> {
            CoPurchase row = inv.getArgument(0);
            store.put(row);
            return row;
        });
    }

    @Test
    void recordsAllOrderedPairsBothWays() {
        when(processedOrderPort.exists("order-1")).thenReturn(false);

        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("order-1", List.of("a", "b", "c"));

        // 3 distinct products -> 3 unordered pairs -> 6 directed inserts
        verify(coPurchasePort, times(6)).save(any());
        ArgumentCaptor<String> processed = ArgumentCaptor.forClass(String.class);
        verify(processedOrderPort).save(processed.capture());
        assertThat(processed.getValue()).isEqualTo("order-1");
        assertThat(store.get("a", "b").count()).isEqualTo(1L);
        assertThat(store.get("b", "a").count()).isEqualTo(1L);
    }

    @Test
    void incrementsExistingCounters() {
        store.put(new CoPurchase("a", "b", 4L, Instant.EPOCH));
        store.put(new CoPurchase("b", "a", 4L, Instant.EPOCH));
        when(processedOrderPort.exists("order-2")).thenReturn(false);

        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("order-2", List.of("a", "b"));

        assertThat(store.get("a", "b").count()).isEqualTo(5L);
        assertThat(store.get("b", "a").count()).isEqualTo(5L);
    }

    @Test
    void deduplicatesProductIdsWithinOneOrder() {
        when(processedOrderPort.exists("order-3")).thenReturn(false);

        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("order-3", Arrays.asList("a", "a", "b"));

        // After distinct -> 2 products -> 1 unordered pair -> 2 directed inserts
        verify(coPurchasePort, times(2)).save(any());
    }

    @Test
    void skipsAlreadyProcessedOrder() {
        when(processedOrderPort.exists("order-replay")).thenReturn(true);

        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("order-replay", List.of("a", "b"));

        verifyNoInteractions(coPurchasePort);
    }

    @Test
    void singleItemOrderRecordsProcessedButNoCoPurchases() {
        when(processedOrderPort.exists("order-solo")).thenReturn(false);

        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("order-solo", List.of("a"));

        verifyNoInteractions(coPurchasePort);
        verify(processedOrderPort).save(any());
    }

    @Test
    void blankOrderIdIsIgnored() {
        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("  ", List.of("a", "b"));

        verifyNoInteractions(coPurchasePort);
        verifyNoInteractions(processedOrderPort);
    }

    @Test
    void nullProductsListIsIgnored() {
        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("order-null", null);

        verifyNoInteractions(coPurchasePort);
        verify(processedOrderPort).save(any());
    }

    @Test
    void filtersBlankAndNullProductIds() {
        when(processedOrderPort.exists("order-blanks")).thenReturn(false);

        new CoPurchaseAggregator(coPurchasePort, processedOrderPort)
                .recordOrder("order-blanks", Arrays.asList(null, "", "a", " ", "b"));

        // After filter -> 2 distinct -> 2 directed inserts
        verify(coPurchasePort, times(2)).save(any());
    }

    private static final class InMemoryCoPurchaseStore {
        private final Map<String, CoPurchase> rows = new HashMap<>();

        CoPurchase get(String productA, String productB) {
            return rows.get(productA + "\0" + productB);
        }

        void put(CoPurchase row) {
            rows.put(row.productA() + "\0" + row.productB(), row);
        }
    }
}
