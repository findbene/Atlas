/**
 * Day-streak maintenance. Bumped from the step-submit route on the first
 * passing submission of each calendar day (in the user's timezone). Works
 * idempotently: same day → no change; consecutive day → +1; gap → reset to 1.
 *
 * Notes:
 * - Date math is done in the user's timezone (default UTC) so a learner who
 *   studies right before midnight in their local TZ doesn't accidentally lose
 *   their streak when the row is compared as UTC.
 * - Writes go through an upsert so the very first activity creates the row.
 *   The unique index on (user_id) makes this safe.
 */
import { db, userStreaks } from "@workspace/db";
import { sql } from "drizzle-orm";

function dateInTimezone(d: Date, tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(d); // YYYY-MM-DD
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.UTC(+aIso.slice(0, 4), +aIso.slice(5, 7) - 1, +aIso.slice(8, 10));
  const b = Date.UTC(+bIso.slice(0, 4), +bIso.slice(5, 7) - 1, +bIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export interface BumpedStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  /** True only when this call actually changed the activity date. */
  advanced: boolean;
}

/**
 * Atomic streak bump via a single `INSERT ... ON CONFLICT DO UPDATE`. The
 * date comparison (and the decision to keep, advance, or reset the streak)
 * happens entirely inside the SQL statement, so:
 *   - concurrent submissions cannot read-then-write past each other
 *   - a slow request straddling local-midnight can't roll back a newer
 *     `last_activity_date` written by a faster request, because the UPDATE
 *     path uses GREATEST(existing, new) for the date and bails out (no-op)
 *     when the row already has a >= date.
 * The expression `EXCLUDED.last_activity_date` refers to the value we tried
 * to insert (today, in the user's TZ); `user_streaks.last_activity_date` is
 * the existing row.
 */
export async function bumpStreak(userId: string, tz: string = "UTC"): Promise<BumpedStreak> {
  const today = dateInTimezone(new Date(), tz || "UTC");
  const result = await db.execute(sql`
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
    VALUES (${userId}, 1, 1, ${today}::date, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET
        -- Same day → no change. Consecutive day → +1. Older "today" (slow
        -- request from yesterday arriving after midnight write) → no-op.
        -- Gap > 1 → reset to 1.
        current_streak = CASE
          WHEN user_streaks.last_activity_date = EXCLUDED.last_activity_date THEN user_streaks.current_streak
          WHEN EXCLUDED.last_activity_date < user_streaks.last_activity_date THEN user_streaks.current_streak
          WHEN EXCLUDED.last_activity_date = user_streaks.last_activity_date + INTERVAL '1 day' THEN user_streaks.current_streak + 1
          ELSE 1
        END,
        longest_streak = GREATEST(
          user_streaks.longest_streak,
          CASE
            WHEN user_streaks.last_activity_date = EXCLUDED.last_activity_date THEN user_streaks.current_streak
            WHEN EXCLUDED.last_activity_date < user_streaks.last_activity_date THEN user_streaks.current_streak
            WHEN EXCLUDED.last_activity_date = user_streaks.last_activity_date + INTERVAL '1 day' THEN user_streaks.current_streak + 1
            ELSE 1
          END
        ),
        -- Never move the activity date backwards.
        last_activity_date = GREATEST(user_streaks.last_activity_date, EXCLUDED.last_activity_date),
        updated_at = NOW()
    RETURNING
      current_streak AS "currentStreak",
      longest_streak AS "longestStreak",
      to_char(last_activity_date, 'YYYY-MM-DD') AS "lastActivityDate",
      (xmax = 0) AS "wasInsert"
  `);
  const row = result.rows[0] as {
    currentStreak: number; longestStreak: number; lastActivityDate: string; wasInsert: boolean;
  } | undefined;
  if (!row) {
    return { currentStreak: 0, longestStreak: 0, lastActivityDate: today, advanced: false };
  }
  // We use the table userStreaks import so the file declares a runtime dep —
  // also helps any future drizzle-introspection tools see the link.
  void userStreaks;
  return {
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    lastActivityDate: row.lastActivityDate,
    advanced: row.wasInsert || row.lastActivityDate === today,
  };
}
