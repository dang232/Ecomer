import { createJwtStrategyOptions, JwtStrategy } from "./jwt.strategy";

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
    const options = createJwtStrategyOptions();

    expect(options.issuer).toBe("http://localhost:9090/realms/vnshop");
    expect(options.audience).toBe("vnshop-api");
    expect(options.algorithms).toEqual(["RS256"]);
  });

  it("falls back to defaults when env vars are unset", () => {
    delete process.env.KEYCLOAK_ISSUER_URI;
    delete process.env.KEYCLOAK_JWK_SET_URI;
    expect(() => new JwtStrategy()).not.toThrow();
  });
});
