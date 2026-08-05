// Component-level render tests for AdminDashboard are deferred — happy-dom +
// I18nextProvider + react-router hooks produce an empty DOM tree even with full
// endpoint mocks. The dashboard data plumbing is covered by
// ./admin-dashboard.test-data.ts and dashboard-view.test.ts.
import { describe, it } from "vitest";

describe("AdminDashboard (deferred)", () => {
  it("placeholder — see file comment", () => undefined);
});
