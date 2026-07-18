import { ServiceUnavailableException } from "@nestjs/common";
import { DiscoveryController } from "./discovery.controller.js";

describe("DiscoveryController OpenAPI endpoint", () => {
  it("returns the current aggregate document", () => {
    const document = { openapi: "3.1.0", paths: {} };
    const controller = new DiscoveryController({
      getOpenApiDocument: jest.fn().mockReturnValue(document),
    } as never);

    expect(controller.getOpenApiDocument()).toBe(document);
  });

  it("returns service unavailable when no valid document exists", () => {
    const controller = new DiscoveryController({
      getOpenApiDocument: jest.fn().mockReturnValue(undefined),
    } as never);

    expect(() => controller.getOpenApiDocument()).toThrow(
      ServiceUnavailableException,
    );
  });
});
