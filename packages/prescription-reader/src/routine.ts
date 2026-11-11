import type { ScheduledDose } from "./schema.ts";

/**
 * Fixed reminder times. Doses close to one of these are grouped on it, so the
 * patient takes several medicines at 08:00 instead of 08:00 and 08:30.
 */
export const ANCHOR_TIMES = ["08:00", "12:00", "20:00"] as const;

/** A dose within this many minutes of an anchor time moves to it. */
export const GROUPING_WINDOW_MINUTES = 60;

/**
 * Anchors whose clock time is a clinical instruction (fasting, before a meal)
 * and must not be grouped with the meal itself.
 */
export const UNGROUPED_ANCHORS: ReadonlySet<ScheduledDose["anchor"]> = new Set([
  "wake_up",
  "before_breakfast",
  "before_lunch",
  "before_dinner",
]);

/**
 * Default daily routine used to turn "after breakfast" or "8/8h" into clock times.
 * Meals sit on the anchor times (08:00, 12:00, 20:00) so medicines taken with or
 * after a meal share one reminder. It is a demo default; the family can edit times.
 */
export const DEFAULT_ROUTINE: Record<ScheduledDose["anchor"], string | null> = {
  fixed_time: null,
  wake_up: "07:00",
  morning: "08:00",
  before_breakfast: "07:30",
  breakfast: "08:00",
  after_breakfast: "08:00",
  before_lunch: "11:30",
  lunch: "12:00",
  after_lunch: "12:00",
  afternoon: "15:00",
  before_dinner: "19:30",
  dinner: "20:00",
  after_dinner: "20:00",
  night: "20:00",
  bedtime: "22:00",
};

/** Times for interval posology ("de X em X horas"). */
export const INTERVAL_TIMES: Record<number, string[]> = {
  24: ["08:00"],
  12: ["08:00", "20:00"],
  8: ["06:00", "14:00", "22:00"],
  6: ["06:00", "12:00", "18:00", "00:00"],
  4: ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"],
};

/** Times for "N vezes ao dia" without interval or meal anchors. */
export const TIMES_PER_DAY: Record<number, string[]> = {
  1: ["08:00"],
  2: ["08:00", "20:00"],
  3: ["08:00", "14:00", "20:00"],
  4: ["08:00", "12:00", "16:00", "20:00"],
};

/** Human-readable table embedded in the prompt so the model and the code agree. */
export function routineTable(): string {
  const anchors = Object.entries(DEFAULT_ROUTINE)
    .filter(([, time]) => time !== null)
    .map(([anchor, time]) => `- ${anchor}: ${time}`)
    .join("\n");
  const intervals = Object.entries(INTERVAL_TIMES)
    .map(([hours, times]) => `- every ${hours}h: ${times.join(", ")}`)
    .join("\n");
  const perDay = Object.entries(TIMES_PER_DAY)
    .map(([n, times]) => `- ${n}x/day with no other cue: ${times.join(", ")}`)
    .join("\n");
  return `Meal and period anchors (with, after and during a meal share the meal time):\n${anchors}\n\nIntervals:\n${intervals}\n\nTimes per day:\n${perDay}`;
}
