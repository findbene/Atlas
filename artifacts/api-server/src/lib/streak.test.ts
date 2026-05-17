/**
 * Tests for the atomic streak bump. The helper compiles down to a single
 * `INSERT ... ON CONFLICT DO UPDATE`, so most of the behaviour belongs to
 * Postgres — we mock `db.execute` and verify (a) we pass the user's TZ-local
 * date as the activity date, (b) we return the row Postgres gave back, and
 * (c) we tolerate an empty result set without throwing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const executeSpy = vi.fn();

vi.mock("@workspace/db", () => ({
  db: { execute: (...args: unknown[]) => executeSpy(...args) },
  userStreaks: { userId: "userId" },
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
    {},
  ),
}));

beforeEach(() => {
  executeSpy.mockReset();
});

async function load() {
  return await import("./streak");
}

describe("bumpStreak", () => {
  it("returns the row Postgres returns and reports advanced=true on insert", async () => {
    executeSpy.mockResolvedValue({
      rows: [{
        currentStreak: 1, longestStreak: 1,
        lastActivityDate: "2026-05-17", wasInsert: true,
      }],
    });
    const { bumpStreak } = await load();
    const out = await bumpStreak("user-1", "UTC");
    expect(out.currentStreak).toBe(1);
    expect(out.longestStreak).toBe(1);
    expect(out.advanced).toBe(true);
    // The interpolated values should include the userId and a YYYY-MM-DD date.
    const call = executeSpy.mock.calls[0]?.[0] as { vals: unknown[] };
    expect(call.vals[0]).toBe("user-1");
    expect(call.vals[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports advanced=false when DB returned an older lastActivityDate", async () => {
    executeSpy.mockResolvedValue({
      rows: [{
        currentStreak: 3, longestStreak: 5,
        lastActivityDate: "2026-05-16", wasInsert: false,
      }],
    });
    const { bumpStreak } = await load();
    const out = await bumpStreak("user-1", "UTC");
    // Today (per the helper) is later than 2026-05-16, so we know the DB
    // skipped this write — advanced should be false.
    expect(out.advanced).toBe(false);
    expect(out.currentStreak).toBe(3);
    expect(out.longestStreak).toBe(5);
  });

  it("returns a safe zero state when the upsert returns no rows", async () => {
    executeSpy.mockResolvedValue({ rows: [] });
    const { bumpStreak } = await load();
    const out = await bumpStreak("user-1", "UTC");
    expect(out).toMatchObject({ currentStreak: 0, longestStreak: 0, advanced: false });
  });

  it("uses the supplied timezone to compute today's date", async () => {
    executeSpy.mockResolvedValue({
      rows: [{
        currentStreak: 1, longestStreak: 1,
        lastActivityDate: "2026-05-17", wasInsert: true,
      }],
    });
    const { bumpStreak } = await load();
    // Pin a moment that lands on different calendar dates in UTC vs Pacific.
    vi.useFakeTimers();
    try {
      // 2026-05-18T03:30:00Z → UTC=2026-05-18, America/Los_Angeles=2026-05-17
      vi.setSystemTime(new Date("2026-05-18T03:30:00Z"));
      await bumpStreak("user-1", "America/Los_Angeles");
      const laCall = executeSpy.mock.calls[0]?.[0] as { vals: unknown[] };
      expect(laCall.vals[1]).toBe("2026-05-17");

      executeSpy.mockClear();
      executeSpy.mockResolvedValue({
        rows: [{
          currentStreak: 1, longestStreak: 1,
          lastActivityDate: "2026-05-18", wasInsert: true,
        }],
      });
      await bumpStreak("user-1", "UTC");
      const utcCall = executeSpy.mock.calls[0]?.[0] as { vals: unknown[] };
      expect(utcCall.vals[1]).toBe("2026-05-18");
    } finally {
      vi.useRealTimers();
    }
  });
});
