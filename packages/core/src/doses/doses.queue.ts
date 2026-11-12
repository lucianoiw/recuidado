// Dose follow-up flow:
// 0. Every hour (and when a medication is saved): create upcoming doses and queue their reminders.
// 1. At scheduledAt: push notification to the patient ("tomei" button).
// 2. No confirmation after DOSE_CALL_AFTER_MINUTES: voice call (apps/voice).
// 3. Still no confirmation after DOSE_ALERT_AFTER_MINUTES more: alert the family by push.
//    If she said on the call she has not taken it yet, one more call DOSE_RECALL_MINUTES later comes first.
// Job ids are fixed per dose (`${kind}-${doseId}`; BullMQ rejects ":") so a job is never queued twice.
export const DOSES_QUEUE = 'doses';

export type DoseJob =
  | { kind: 'plan' }
  // The demo run (apps/api/src/demo) passes short waits; real doses use the env minutes.
  | { kind: 'remind'; doseId: string; callAfterMs?: number; alertAfterMs?: number }
  | { kind: 'call'; doseId: string }
  | { kind: 'alert-family'; doseId: string }
  // She said "ainda não" on the call: call once more to confirm.
  | { kind: 'recall'; doseId: string }
  // She reported an emergency on the call: call her back a few minutes later.
  | { kind: 'check-in'; doseId: string; attempt?: number }
  // The caregiver called in an emergency did not hear the message: call the next one in order.
  | { kind: 'next-contact'; doseId: string; afterId: string; message: string };

export function doseJobId(kind: 'remind' | 'call' | 'alert-family' | 'check-in' | 'recall', doseId: string) {
  return `${kind}-${doseId}`;
}
