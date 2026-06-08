/**
 * Phase 60F — CORS allowlist resolution.
 *
 * Pins the three resolution branches + the per-origin callback so a future
 * change can't silently re-introduce the reflective `origin:true` +
 * `credentials:true` posture in dev/test, and so production stays inert until
 * an operator opts into the allowlist.
 */
import { describe, expect, it } from "vitest";
import { buildCorsOptions, resolveAllowedOrigins } from "./cors";

type OriginCb = (err: Error | null, allow?: boolean) => void;
type OriginFn = (origin: string | undefined, cb: OriginCb) => void;

/** Invoke a CorsOptions.origin function and return what it passed to cb. */
function callOrigin(
  fn: CorsOptionsOriginUnknown,
  origin: string | undefined,
): { err: Error | null; allow: boolean | undefined } {
  let captured: { err: Error | null; allow: boolean | undefined } = {
    err: null,
    allow: undefined,
  };
  (fn as OriginFn)(origin, (err, allow) => {
    captured = { err, allow };
  });
  return captured;
}
// The cors typings widen `origin` to a union; in the allowlist branch it is
// always our custom function — narrow via unknown for the test only.
type CorsOptionsOriginUnknown = unknown;

describe("Phase 60F — resolveAllowedOrigins", () => {
  it("parses ATLAS_ALLOWED_ORIGINS into a trimmed, non-empty list (any env)", () => {
    expect(
      resolveAllowedOrigins({
        NODE_ENV: "production",
        ATLAS_ALLOWED_ORIGINS: "https://app.example.com, https://www.example.com ,",
      } as NodeJS.ProcessEnv),
    ).toEqual(["https://app.example.com", "https://www.example.com"]);
  });

  it("defaults to local dev/test origins when unset in non-production", () => {
    const origins = resolveAllowedOrigins({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(origins).toContain("http://localhost:5173");
    expect(origins).not.toBeNull();
  });

  it("returns null (legacy-reflective fallback) only in production when unset", () => {
    expect(
      resolveAllowedOrigins({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });
});

describe("Phase 60F — buildCorsOptions", () => {
  it("allowlist mode: allows listed origins + no-Origin, rejects unknown — never wildcard+credentials", () => {
    const opts = buildCorsOptions({
      NODE_ENV: "production",
      ATLAS_ALLOWED_ORIGINS: "https://app.example.com",
    } as NodeJS.ProcessEnv);

    // Not the reflective boolean — it's a custom function in allowlist mode.
    expect(typeof opts.origin).toBe("function");
    expect(opts.credentials).toBe(true);

    const listed = callOrigin(opts.origin, "https://app.example.com");
    expect(listed.err).toBeNull();
    expect(listed.allow).toBe(true);

    const unknown = callOrigin(opts.origin, "https://evil.example.net");
    expect(unknown.err).toBeNull(); // false, NOT an error → no 500
    expect(unknown.allow).toBe(false);

    // Non-browser / same-origin (no Origin header) is allowed.
    const noOrigin = callOrigin(opts.origin, undefined);
    expect(noOrigin.allow).toBe(true);
  });

  it("dev/test mode (unset): allowlist of localhost origins, rejects arbitrary sites", () => {
    const opts = buildCorsOptions({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(typeof opts.origin).toBe("function");
    expect(opts.credentials).toBe(true);
    expect(callOrigin(opts.origin, "http://localhost:5173").allow).toBe(true);
    expect(callOrigin(opts.origin, "https://evil.example.net").allow).toBe(false);
  });

  it("production + unset: production-inert legacy reflective posture (origin:true)", () => {
    const opts = buildCorsOptions({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    // Byte-identical to the pre-60F default so production behaviour is unchanged.
    expect(opts.origin).toBe(true);
    expect(opts.credentials).toBe(true);
  });
});
