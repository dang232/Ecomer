import type { MikroORM } from "@mikro-orm/core";

import { AppController } from "./app.controller";

describe("AppController", () => {
  const orm = { isConnected: jest.fn() };
  const controller = new AppController(orm as unknown as MikroORM);

  beforeEach(() => {
    orm.isConnected.mockResolvedValue(true);
  });

  it("returns ok health envelope", () => {
    const result = controller.health();
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: "ok" });
  });

  it("returns ok readiness envelope when PostgreSQL is connected", async () => {
    const result = await controller.ready();
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: "ready" });
  });

  it("fails readiness when PostgreSQL is disconnected", async () => {
    orm.isConnected.mockResolvedValue(false);

    await expect(controller.ready()).rejects.toThrow("database unavailable");
  });
});
