import posthog from "posthog-js";

type Props = Record<string, string | number | boolean | null | undefined>;

/** Product event from the browser. Does nothing when PostHog is not configured. */
export function track(event: string, properties?: Props): void {
  if (posthog.__loaded) posthog.capture(event, properties);
}

/** Links this browser to a member, so web and server events land on the same person. */
export function identifyMember(memberId: string, role: "patient" | "caregiver", familyId: string): void {
  if (!posthog.__loaded) return;
  if (posthog.get_distinct_id() !== memberId) posthog.identify(memberId, { role });
  posthog.register({ role, family_id: familyId });
}

export function captureError(error: unknown, properties?: Props): void {
  if (posthog.__loaded) posthog.captureException(error, properties);
}
