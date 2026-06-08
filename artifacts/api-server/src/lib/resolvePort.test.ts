import { describe, it, expect } from "vitest";
import { resolvePort, isProductionEnv } from "./resolvePort";

// Phase 0.2 regression guard. These pin the new local-boot behavior; the first
// assertion fails against the pre-0.2 code, which threw unconditionally when PORT
// was unset (it had no dev default).
describe("resolvePort", () => {
  it("defaults to 3000 when PORT is unset in local dev", () => {
    expect(resolvePort({ NODE_ENV: "development" })).toBe(3000);
    expect(resolvePort({})).toBe(3000);
  });

  it("honors an explicit PORT in any environment", () => {
    expect(resolvePort({ PORT: "8080", NODE_ENV: "production" })).toBe(8080);
    expect(resolvePort({ PORT: "4123", NODE_ENV: "development" })).toBe(4123);
  });

  it("throws when PORT is unset and NODE_ENV=production", () => {
    expect(() => resolvePort({ NODE_ENV: "production" })).toThrow(
      /PORT environment variable is required/,
    );
  });

  it("throws when PORT is unset and REPLIT_DEPLOYMENT=1", () => {
    expect(() => resolvePort({ REPLIT_DEPLOYMENT: "1" })).toThrow(
      /PORT environment variable is required/,
    );
  });

  it("throws on a non-numeric PORT", () => {
    expect(() => resolvePort({ PORT: "abc", NODE_ENV: "development" })).toThrow(
      /Invalid PORT value/,
    );
  });

  it("throws on an explicitly empty PORT (misconfig, fail loud)", () => {
    expect(() => resolvePort({ PORT: "", NODE_ENV: "development" })).toThrow(
      /Invalid PORT value/,
    );
  });

  it("throws on a non-positive PORT", () => {
    expect(() => resolvePort({ PORT: "0", NODE_ENV: "development" })).toThrow(
      /Invalid PORT value/,
    );
    expect(() => resolvePort({ PORT: "-5", NODE_ENV: "development" })).toThrow(
      /Invalid PORT value/,
    );
  });
});

describe("isProductionEnv", () => {
  it("detects both production signals", () => {
    expect(isProductionEnv({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionEnv({ REPLIT_DEPLOYMENT: "1" })).toBe(true);
  });

  it("is false in local dev", () => {
    expect(isProductionEnv({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionEnv({})).toBe(false);
  });
});
