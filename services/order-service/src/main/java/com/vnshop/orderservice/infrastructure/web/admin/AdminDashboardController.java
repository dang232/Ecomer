package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.application.GetDashboardUseCase;
import com.vnshop.orderservice.application.DashboardCsvExporter;
import com.vnshop.orderservice.domain.DashboardReport;
import com.vnshop.orderservice.domain.DashboardGranularity;
import com.vnshop.orderservice.domain.DashboardQuery;
import com.vnshop.orderservice.infrastructure.web.ApiResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/admin/dashboard")
public class AdminDashboardController {
    private final GetDashboardUseCase getDashboardUseCase;
    private final DashboardCsvExporter dashboardCsvExporter;
    private final Clock clock;

    public AdminDashboardController(
            GetDashboardUseCase getDashboardUseCase,
            DashboardCsvExporter dashboardCsvExporter,
            Clock clock) {
        this.getDashboardUseCase = getDashboardUseCase;
        this.dashboardCsvExporter = dashboardCsvExporter;
        this.clock = clock;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/report")
    public ApiResponse<DashboardReportResponse> report(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "day") String granularity,
            @RequestParam(required = false, defaultValue = "10") int limit) {
        return ApiResponse.ok(DashboardReportResponse.fromDomain(
                getDashboardUseCase.report(query(from, to, granularity, limit))));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "day") String granularity,
            @RequestParam(required = false, defaultValue = "10") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant asOf) {
        DashboardQuery exportQuery = query(from, to, granularity, limit);
        DashboardReport report = getDashboardUseCase.report(asOf == null ? exportQuery : exportQuery.withAsOf(asOf));
        byte[] body = dashboardCsvExporter.export(report);
        String filename = "vnshop-dashboard-" + report.periodStart() + "-to-" + report.periodEnd() + ".csv";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        return ResponseEntity.ok().headers(headers).body(body);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/summary")
    public ApiResponse<DashboardSummaryResponse> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(DashboardSummaryResponse.fromDomain(
                getDashboardUseCase.summary(query(from, to, "day", 10))));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/revenue")
    public ApiResponse<RevenueTimeSeriesResponse> revenue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "day") String granularity) {
        return ApiResponse.ok(RevenueTimeSeriesResponse.fromDomain(
                getDashboardUseCase.revenue(query(from, to, granularity, 10))));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/top-products")
    public ApiResponse<List<TopProductResponse>> topProducts(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "day") String granularity,
            @RequestParam(required = false, defaultValue = "10") int limit) {
        return ApiResponse.ok(getDashboardUseCase.topProducts(query(from, to, granularity, limit)).stream()
                .map(TopProductResponse::fromDomain).toList());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/top-sellers")
    public ApiResponse<List<TopSellerResponse>> topSellers(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "day") String granularity,
            @RequestParam(required = false, defaultValue = "10") int limit) {
        return ApiResponse.ok(getDashboardUseCase.topSellers(query(from, to, granularity, limit)).stream()
                .map(TopSellerResponse::fromDomain).toList());
    }

    private DashboardQuery query(LocalDate from, LocalDate to, String granularity, int limit) {
        LocalDate defaultTo = LocalDate.now(clock);
        LocalDate effectiveTo = to == null ? defaultTo : to;
        LocalDate effectiveFrom = from == null ? effectiveTo.minusDays(29) : from;
        return new DashboardQuery(effectiveFrom, effectiveTo, DashboardGranularity.parse(granularity), limit);
    }
}
