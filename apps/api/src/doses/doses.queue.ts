// Dose follow-up flow:
// 1. At scheduledAt: push notification to the patient ("tomei" button).
// 2. No confirmation after DOSE_CALL_AFTER_MINUTES: voice call (apps/voice).
// 3. Still no confirmation after DOSE_ALERT_AFTER_MINUTES: alert the family.
export const DOSES_QUEUE = 'doses';

export type DoseJob =
  | { kind: 'remind'; doseId: string }
  | { kind: 'call'; doseId: string }
  | { kind: 'alert-family'; doseId: string };
