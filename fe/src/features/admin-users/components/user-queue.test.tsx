import { describe, expect, it } from "vitest";

import { ADMIN_QUEUE_CAPABILITIES } from "@/features/admin";

describe("admin-users capabilities", () => {
  it("users queue has search capability", () => {
    const caps = ADMIN_QUEUE_CAPABILITIES.users;
    expect(caps.search).toBe(true);
  });

  it("users queue has ban/unban actions", () => {
    const caps = ADMIN_QUEUE_CAPABILITIES.users;
    expect("ban" in caps.actions).toBe(true);
    expect("unban" in caps.actions).toBe(true);
  });

  it("users queue has server pagination", () => {
    const caps = ADMIN_QUEUE_CAPABILITIES.users;
    expect(caps.pagination).toBe("server");
  });

  it("users queue has single selection", () => {
    const caps = ADMIN_QUEUE_CAPABILITIES.users;
    expect(caps.selection).toBe("single");
  });

  it("ban action has no required inputs", () => {
    const caps = ADMIN_QUEUE_CAPABILITIES.users;
    expect(caps.actions.ban.inputs).toEqual({});
  });

  it("unban action has no required inputs", () => {
    const caps = ADMIN_QUEUE_CAPABILITIES.users;
    expect(caps.actions.unban.inputs).toEqual({});
  });
});
