/**
 * Calendar heatmap for the last 12 weeks (84 days) of step-completion
 * activity, GitHub-contributions style. Pairs with a daily-goal target
 * stored in localStorage so it's per-device and doesn't need a migration.
 */
import { useEffect, useMemo, useState } from "react";
import { Flame, Target } from "lucide-react";

interface ActivityDay { date: string; count: number; }
interface ActivityResponse { days: number; timezone: string; activity: ActivityDay[]; }

const GOAL_STORAGE_KEY = "atlas.dailyGoalSteps";

function getGoal(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(GOAL_STORAGE_KEY);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 50 ? n : 1;
}

function setGoal(n: number) {
  window.localStorage.setItem(GOAL_STORAGE_KEY, String(n));
}

// Map a count → a tailwind-ish hex intensity. Tuned to read in dark mode.
function intensityColor(count: number, goal: number): string {
  if (count === 0) return "rgb(38 38 42 / 0.55)"; // empty cell
  const ratio = Math.min(count / Math.max(goal, 1), 3); // cap at 3× goal
  if (ratio >= 2) return "#15803d";
  if (ratio >= 1) return "#22c55e";
  if (ratio >= 0.5) return "#86efac";
  return "#4ade80";
}

export function StreakHeatmap({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoalState] = useState<number>(1);

  useEffect(() => {
    setGoalState(getGoal());
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    void (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/user/activity?days=84&tz=${encodeURIComponent(tz)}`,
          { credentials: "include" },
        );
        if (cancelled) return;
        if (!res.ok) { setData(null); return; }
        setData((await res.json()) as ActivityResponse);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Arrange the 84 days into a 7×12 grid (rows = weekday Sun→Sat, cols = weeks).
  // The right-most column is the current partial week. We align by computing
  // each day's weekday in the user's local TZ.
  const grid = useMemo(() => {
    if (!data) return null;
    const days = data.activity;
    const weeks: Array<Array<ActivityDay | null>> = [];
    // Compute the weekday of the first day and pad the leading cells.
    const first = new Date(days[0]!.date + "T12:00:00");
    const lead = first.getDay(); // 0=Sun
    let week: Array<ActivityDay | null> = Array.from({ length: lead }, () => null);
    for (const d of days) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [data]);

  const today = data?.activity[data.activity.length - 1];
  const todayCount = today?.count ?? 0;
  const goalMet = todayCount >= goal;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4" data-testid="streak-heatmap">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            Activity
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-orange-300 font-medium">{currentStreak}-day</span> current
            · <span className="text-muted-foreground">{longestStreak}-day</span> best
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-emerald-400" />
            Daily goal:
            <select
              className="bg-background border border-border rounded px-1.5 py-0.5 text-xs"
              value={goal}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setGoal(n);
                setGoalState(n);
              }}
              data-testid="daily-goal-select"
            >
              {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n} step{n > 1 ? "s" : ""}/day</option>)}
            </select>
          </label>
          <div
            className={`text-xs font-medium px-2 py-1 rounded ${
              goalMet
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
            data-testid="daily-goal-status"
          >
            {goalMet ? `Goal met ✓` : `${todayCount}/${goal} today`}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-24 bg-muted/30 rounded animate-pulse" />
      ) : !grid ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No activity data yet — complete a step to start your streak.
        </p>
      ) : (
        <div className="flex gap-[3px] overflow-x-auto">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="h-3 w-3 rounded-sm"
                  style={{
                    backgroundColor: day
                      ? intensityColor(day.count, goal)
                      : "transparent",
                  }}
                  title={day ? `${day.date}: ${day.count} step${day.count === 1 ? "" : "s"}` : ""}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 0.5, 1, 2].map(r => (
          <div
            key={r}
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: intensityColor(Math.max(1, Math.round(r * goal)), goal) === intensityColor(0, goal) && r === 0 ? "rgb(38 38 42 / 0.55)" : intensityColor(Math.max(1, Math.round(r * goal)), goal) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
