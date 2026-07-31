import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const dict: Record<string, string> = {
        "admin.health.title": "System Health",
        "admin.health.refresh": "Refresh",
        "admin.health.checking": "Checking...",
        "admin.health.up": "Up",
        "admin.health.down": "Down",
        "admin.health.gateway": "Gateway",
        "admin.health.userService": "User service",
        "admin.health.orderService": "Order service",
        "admin.health.paymentService": "Payment service",
        "admin.health.catalogService": "Catalog service",
        "admin.health.notificationService": "Notification service",
        "admin.health.allUp": "All systems operational",
        "admin.health.someDown": "Some services are down",
        "admin.health.lastChecked": "Last checked: {{time}}",
      };
      return dict[key] ?? opts?.defaultValue ?? key;
    },
    i18n: { language: "en" },
  }),
}));

import { SystemHealth } from "./system-health";

describe("SystemHealth", () => {
  it("renders the system health title", () => {
    render(<SystemHealth />);
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });

  it("renders one row per registered service", () => {
    render(<SystemHealth />);
    // The path strings include /health (Spring Boot Actuator) or /health (NestJS)
    expect(screen.getAllByText(/\/health/).length).toBeGreaterThanOrEqual(6);
  });

  it("renders the refresh button", () => {
    render(<SystemHealth />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });
});