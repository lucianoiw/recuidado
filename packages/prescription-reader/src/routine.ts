import type { ScheduledDose } from "./schema.ts";

/**
 * Default daily routine used to turn "after breakfast" or "8/8h" into clock times.
 * It is a demo default for an older adult; the family can edit times in the app.
 */
export const DEFAULT_ROUTINE: Record<ScheduledDose["anchor"], string | null> = {
  fixed_time: null,
  wake_up: "07:00",
  morning: "08:00",
  before_breakfast: "07:30",
  breakfast: "08:00",
  after_breakfast: "08:30",
  before_lunch: "11:30",
  lunch: "12:00",
  after_lunch: "12:30",
  afternoon: "15:00",
  before_dinner: "18:30",
  dinner: "19:00",
  after_dinner: "19:30",
  night: "21:00",
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
  return `Meal and period anchors:\n${anchors}\n\nIntervals:\n${intervals}\n\nTimes per day:\n${perDay}`;
}
