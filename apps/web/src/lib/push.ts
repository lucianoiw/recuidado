import { API_URL } from "./api";

export type PushState = "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function publicKey(): Promise<string> {
  const fromBuild = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (fromBuild) return fromBuild;
  const res = await fetch(`${API_URL}/push/public-key`);
  const body = (await res.json()) as { publicKey: string | null };
  if (!body.publicKey) throw new Error("Push não configurado no servidor.");
  return body.publicKey;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Asks permission, subscribes this browser and saves it for the member. */
export async function enablePush(memberId: string): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(await publicKey()),
    }));

  const res = await fetch(`${API_URL}/push/subscriptions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memberId, subscription: sub.toJSON() }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return "on";
}

export async function sendTestPush(memberId: string): Promise<void> {
  await fetch(`${API_URL}/push/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memberId }),
  });
}

/** Stops notifications on this device: removes the subscription here and in the API. */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch(`${API_URL}/push/subscriptions`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
  return "off";
}
