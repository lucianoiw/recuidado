// While a demo run is going, the family and patient screens refresh every few seconds
// instead of every 30, so the video shows each step as it happens.
const KEY = "recuidado:demo-run";
const FAST_FOR_MS = 4 * 60 * 1000;

export interface SavedDemoRun {
  doseId: string;
  startedAt: number;
}

export function saveDemoRun(doseId: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ doseId, startedAt: Date.now() }));
  } catch {
    // Private mode: the demo page still works, the other screens refresh at the normal pace.
  }
}

export function readDemoRun(): SavedDemoRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedDemoRun) : null;
  } catch {
    return null;
  }
}

/** Refresh interval for screens that show doses. */
export function refreshMs(): number {
  const run = readDemoRun();
  return run && Date.now() - run.startedAt < FAST_FOR_MS ? 3_000 : 30_000;
}
