import axios from "axios";
import { OpenApiFetcher } from "./openapi-fetcher.js";

jest.mock("axios");

describe("OpenApiFetcher", () => {
  const mockedAxios = jest.mocked(axios);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("keeps the complete document and supports Springdoc and NestJS paths", async () => {
    const spec = {
      openapi: "3.0.3",
      info: { title: "Product Service", version: "1.0.0" },
      paths: { "/products": { get: { operationId: "listProducts" } } },
      components: { schemas: { Product: { type: "object" } } },
    };
    mockedAxios.get
      .mockRejectedValueOnce(new Error("default Springdoc path unavailable"))
      .mockResolvedValueOnce({ data: spec });

    const result = await new OpenApiFetcher().fetchOpenApi(
      "http://product-service:8082",
      "product-service",
    );

    expect(result.status).toBe("healthy");
    expect(result.sourcePath).toBe("/api-docs");
    expect(result.spec).toEqual(spec);
    expect(result.endpoints).toHaveLength(1);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      "http://product-service:8082/v3/api-docs",
      expect.any(Object),
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      "http://product-service:8082/api-docs",
      expect.any(Object),
    );
  });

  it("returns a non-throwing missing result when no schema endpoint responds", async () => {
    mockedAxios.get.mockRejectedValue(new Error("unavailable"));

    const result = await new OpenApiFetcher().fetchOpenApi(
      "http://missing-service:8082",
      "missing-service",
    );

    expect(result.status).toBe("missing");
    expect(result.spec).toBeUndefined();
    expect(result.endpoints).toEqual([]);
  });
});
