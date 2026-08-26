import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy (messaging-service)", () => {
  beforeEach(() => {
    process.env.KEYCLOAK_ISSUER_URI = "http://localhost:9090/realms/vnshop";
    process.env.KEYCLOAK_JWK_SET_URI =
      "http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs";
  });

  it("returns the JWT payload from validate so passport hydrates req.user", () => {
    const strategy = new JwtStrategy();
    const payload = { sub: "user-1" };
    expect(strategy.validate(payload)).toBe(payload);
  });

  it("configures the resource audience separately from the issuer", () => {
    const strategy = new JwtStrategy() as unknown as {
      _options: { issuer: string; audience: string; algorithms: string[] };
    };

    expect(strategy._options.issuer).toBe("http://localhost:9090/realms/vnshop");
    expect(strategy._options.audience).toBe("vnshop-api");
    expect(strategy._options.algorithms).toEqual(["RS256"]);
  });

  it("falls back to defaults when env vars are unset", () => {
    delete process.env.KEYCLOAK_ISSUER_URI;
    delete process.env.KEYCLOAK_JWK_SET_URI;
    expect(() => new JwtStrategy()).not.toThrow();
  });
});
