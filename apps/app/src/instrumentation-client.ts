import posthog from "posthog-js";
import { API_URL } from "@/lib/api";

// PostHog: page views, clicks, errors, browser logs, web vitals and session replay.
// Build-time variables (Next inlines NEXT_PUBLIC_*). Without the token nothing is sent.
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  try {
    posthog.init(token, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      capture_exceptions: true,
      capture_performance: { web_vitals: true, network_timing: true },
      enable_recording_console_log: true,
      // LGPD: names, medicines and phones on screen are health data. Replays show layout and clicks only.
      session_recording: { maskAllInputs: true, maskTextSelector: "*" },
      // Sends the session id to the API so its logs and errors link to this replay.
      tracing_headers: [new URL(API_URL).hostname],
      logs: {
        serviceName: "web",
        environment: process.env.NODE_ENV,
        captureConsoleLogs: true,
      },
    });
    posthog.register({ app: "web", service: "web" });
  } catch (error) {
    console.error("PostHog init failed", error);
  }
}
