"use client";

// Phone frames from devices.css (MIT), then the fix for its ".device *" rule.
import "devices.css/dist/devices.min.css";
import "./panel.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Logo } from "@/components/ui";

/** The app the phones open: app.recuidado.com.br next to painel.recuidado.com.br, or this origin locally. */
function appOrigin(): string {
  const { origin, hostname } = window.location;
  return hostname.startsWith("painel.") ? origin.replace("//painel.", "//app.") : origin;
}

// Screen sizes of the devices.css phones (Pixel 6 Pro and Galaxy S8).
const DEVICE_HEIGHT = 870;

export function Panel() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [round, setRound] = useState(0);
  const caregiver = useRef<HTMLIFrameElement>(null);
  const patient = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(appOrigin());
    const fit = () => setScale(Math.min(1, (window.innerHeight - 150) / DEVICE_HEIGHT, (window.innerWidth - 32) / 860));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function startOver() {
    // The frames forget both logins, then both phones start again.
    for (const frame of [caregiver.current, patient.current]) {
      frame?.contentWindow?.postMessage({ type: "recuidado:reset" }, origin ?? "*");
    }
    setTimeout(() => setRound((r) => r + 1), 300);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-4 overflow-hidden bg-[#efe9df] px-4 pb-4 pt-5">
      <header className="flex w-full max-w-[860px] items-center justify-between gap-4">
        <Logo size={28} variant="full" />
        <button
          type="button"
          onClick={startOver}
          className="min-h-10 rounded-xl border-[1.5px] border-ink/30 px-3 text-[14px] font-semibold text-ink/80"
        >
          Começar de novo
        </button>
      </header>

      {origin ? (
        <div
          className="flex items-start justify-center gap-10"
          style={{ transform: `scale(${scale})`, transformOrigin: "top center", height: DEVICE_HEIGHT * scale + 40 }}
        >
          <Phone
            key={`c${round}`}
            label="Celular do filho"
            model="device-google-pixel-6-pro"
            frameRef={caregiver}
            initialUrl={`${origin}/`}
            origin={origin}
          />
          <Phone
            key={`p${round}`}
            label="Celular da mãe"
            model="device-galaxy-s8"
            frameRef={patient}
            initialUrl={null}
            origin={origin}
          />
        </div>
      ) : null}
    </main>
  );
}

function Phone({
  label,
  model,
  frameRef,
  initialUrl,
  origin,
}: {
  label: string;
  model: string;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  initialUrl: string | null;
  origin: string;
}) {
  const [src, setSrc] = useState<string | null>(initialUrl);
  const [shown, setShown] = useState(initialUrl ?? "");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    // The frame tells its address on every page change (components/frame-bridge.tsx).
    function onMessage(e: MessageEvent) {
      if (e.source !== frameRef.current?.contentWindow || e.origin !== origin) return;
      const data = e.data as { type?: string; href?: string } | null;
      if (data?.type === "recuidado:location" && data.href) setShown(data.href);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameRef, origin]);

  function open(e: FormEvent) {
    e.preventDefault();
    let url: URL;
    try {
      url = new URL(typed.trim().replace(/^(?!https?:\/\/)/, "https://"));
    } catch {
      setError(true);
      return;
    }
    // Only the Recuidado app opens here.
    if (url.origin !== origin) {
      setError(true);
      return;
    }
    setError(false);
    setTyped("");
    setSrc(url.toString());
    setShown(url.toString());
  }

  const display = shown.replace(/^https?:\/\//, "");
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className={`device ${model}`}>
        <div className="device-frame">
          <div className="device-screen flex flex-col overflow-hidden bg-white">
            <StatusBar />
            <form onSubmit={open} className="flex h-[52px] shrink-0 items-center gap-2 bg-[#f1f3f4] px-3">
              <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3.5 text-[14px] text-[#3c4043] shadow-[inset_0_0_0_1px_#dadce0]">
                <LockIcon />
                <input
                  aria-label={`Endereço no ${label.toLowerCase()}`}
                  value={typed || (src ? display : "")}
                  onChange={(e) => setTyped(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Cole aqui o link"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#5f6368]"
                />
              </span>
              {typed ? (
                <button type="submit" className="rounded-full bg-brand px-3 py-1.5 text-[13px] font-semibold text-white">
                  Abrir
                </button>
              ) : null}
            </form>
            {error ? (
              <p className="bg-[#fce7e5] px-3 py-2 text-[13px] font-semibold text-danger">
                Cole o link do Recuidado que veio do celular do filho.
              </p>
            ) : null}
            {src ? (
              <iframe
                ref={frameRef}
                src={src}
                title={label}
                allow="clipboard-read; clipboard-write; geolocation; web-share"
                className="w-full flex-1 border-0 bg-bg"
              />
            ) : (
              <EmptyPhone />
            )}
          </div>
        </div>
        <div className="device-stripe" />
        <div className="device-header" />
        <div className="device-sensors" />
        <div className="device-btns" />
        <div className="device-power" />
        <div className="device-home" />
      </div>
      <figcaption className="text-[22px] font-semibold text-ink">{label}</figcaption>
    </figure>
  );
}

/** Her phone before the link arrives. */
function EmptyPhone() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#fbf8f3] px-8 text-center">
      <Logo size={64} />
      <p className="text-[22px] font-semibold leading-tight">Ela não precisa de cadastro.</p>
      <p className="text-[17px] leading-snug text-muted">
        No celular do filho, abra <b className="text-ink">Família</b> e <b className="text-ink">Celular dela</b>, copie o link e
        cole na barra acima.
      </p>
    </div>
  );
}

function StatusBar() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date()));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex h-7 shrink-0 items-center justify-between bg-[#f1f3f4] px-5 text-[13px] font-semibold text-[#202124]">
      <span>{time}</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 12 0 3.5a11.5 11.5 0 0 1 16 0z" fill="currentColor" /></svg>
        <svg width="14" height="12" viewBox="0 0 14 12"><path d="M0 12 14 0v12z" fill="currentColor" /></svg>
        <svg width="10" height="14" viewBox="0 0 10 14"><rect x="2" y="0" width="6" height="2" fill="currentColor" /><rect x="0" y="2" width="10" height="12" rx="1.5" fill="currentColor" /></svg>
      </span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" className="shrink-0">
      <path d="M2 6V4a4 4 0 0 1 8 0v2h1v8H1V6zm2 0h4V4a2 2 0 0 0-4 0z" fill="#5f6368" />
    </svg>
  );
}
