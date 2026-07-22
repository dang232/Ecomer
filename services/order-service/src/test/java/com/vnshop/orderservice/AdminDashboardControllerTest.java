package com.vnshop.orderservice;

import com.vnshop.orderservice.application.DashboardCsvExporter;
import com.vnshop.orderservice.application.GetDashboardUseCase;
import com.vnshop.orderservice.domain.DashboardGranularity;
import com.vnshop.orderservice.domain.DashboardQuery;
import com.vnshop.orderservice.domain.DashboardReport;
import com.vnshop.orderservice.domain.DashboardSummary;
import com.vnshop.orderservice.domain.RevenueTimeSeries;
import com.vnshop.orderservice.domain.TopProduct;
import com.vnshop.orderservice.domain.TopSeller;
import com.vnshop.orderservice.infrastructure.web.ApiExceptionHandler;
import com.vnshop.orderservice.infrastructure.web.admin.AdminDashboardController;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminDashboardControllerTest {
    private static final Instant AS_OF = Instant.parse("2026-07-23T00:00:00Z");

    @Test
    void reportAppliesValidatedQueryParametersAndReturnsSnapshotEnvelope() throws Exception {
        GetDashboardUseCase useCase = mock(GetDashboardUseCase.class);
        DashboardReport report = report();
        when(useCase.report(any(DashboardQuery.class))).thenReturn(report);
        MockMvc mvc = mvc(useCase, mock(DashboardCsvExporter.class));

        mvc.perform(get("/admin/dashboard/report")
                        .param("from", "2026-07-01")
                        .param("to", "2026-07-03")
                        .param("granularity", "week")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.asOf").value("2026-07-23T00:00:00Z"))
                .andExpect(jsonPath("$.data.summary.refundedAmount").value(100000))
                .andExpect(jsonPath("$.data.summary.realizedRevenue").value(900000));

        verify(useCase).report(argThat(query -> query.from().equals(LocalDate.of(2026, 7, 1))
                && query.to().equals(LocalDate.of(2026, 7, 3))
                && query.granularity() == DashboardGranularity.WEEK
                && query.limit() == 5));
    }

    @Test
    void exportUsesTheSameReportContractAndPeriodInFilename() throws Exception {
        GetDashboardUseCase useCase = mock(GetDashboardUseCase.class);
        DashboardCsvExporter exporter = mock(DashboardCsvExporter.class);
        DashboardReport report = report();
        when(useCase.report(any(DashboardQuery.class))).thenReturn(report);
        when(exporter.export(report)).thenReturn("section,value\nsummary,900000\n".getBytes());
        MockMvc mvc = mvc(useCase, exporter);

        mvc.perform(get("/admin/dashboard/export")
                        .param("from", "2026-07-01")
                        .param("to", "2026-07-03"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/csv"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"vnshop-dashboard-2026-07-01-to-2026-07-03.csv\""))
                .andExpect(content().string("section,value\nsummary,900000\n"));

        verify(exporter).export(report);
    }

    @Test
    void exportCanReuseTheReportSnapshotTimestamp() throws Exception {
        GetDashboardUseCase useCase = mock(GetDashboardUseCase.class);
        DashboardCsvExporter exporter = mock(DashboardCsvExporter.class);
        DashboardReport report = report();
        when(useCase.report(any(DashboardQuery.class))).thenReturn(report);
        when(exporter.export(report)).thenReturn("section,value\nsummary,900000\n".getBytes());
        MockMvc mvc = mvc(useCase, exporter);

        mvc.perform(get("/admin/dashboard/export")
                        .param("from", "2026-07-01")
                        .param("to", "2026-07-03")
                        .param("asOf", AS_OF.toString()))
                .andExpect(status().isOk());

        verify(useCase).report(argThat(query -> AS_OF.equals(query.asOf())));
    }

    private static MockMvc mvc(GetDashboardUseCase useCase, DashboardCsvExporter exporter) {
        return MockMvcBuilders.standaloneSetup(new AdminDashboardController(
                        useCase,
                        exporter,
                        Clock.fixed(AS_OF, ZoneOffset.UTC)))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private static DashboardReport report() {
        return new DashboardReport(
                AS_OF,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 3),
                new DashboardSummary(
                        2,
                        new BigDecimal("1000000"),
                        new BigDecimal("100000"),
                        new BigDecimal("900000"),
                        2,
                        1,
                        new BigDecimal("500000"),
                        LocalDate.of(2026, 7, 1),
                        LocalDate.of(2026, 7, 3)),
                new RevenueTimeSeries(List.of(new RevenueTimeSeries.Point(
                        LocalDate.of(2026, 7, 1),
                        new BigDecimal("1000000"),
                        new BigDecimal("100000"),
                        new BigDecimal("900000")))),
                List.of(new TopProduct("product-1", "Headphones", 3)),
                List.of(new TopSeller("seller-1", "Example Shop", new BigDecimal("1000000"))));
    }
}
