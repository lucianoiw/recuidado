"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Logo, TopBar } from "@/components/ui";
import { captureError, track } from "@/lib/analytics";
import { getMe, startSignIn, verifySignIn } from "@/lib/api";
import { isEmail } from "@/lib/masks";
import { readSession } from "@/lib/session";
import { afterSignIn } from "./after-sign-in";

/** E-mail, then the 6 digit code from the e-mail. No password. */
export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const invited = params.get("nome");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Already signed in on this device: go straight on.
    if (!readSession()) return;
    getMe().then(
      async (me) => {
        if (me) router.replace(await afterSignIn(me, params));
      },
      () => {},
    );
  }, [params, router]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!isEmail(email)) {
      setError("Confira o e-mail.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await startSignIn(email.trim());
      track("sign_in_code_sent");
      setCode("");
      setStep("code");
    } catch (err) {
      captureError(err, { screen: "sign-in" });
      setError(err instanceof Error ? err.message : "Não deu para enviar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e?: FormEvent) {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("O código tem 6 números.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await verifySignIn({ email: email.trim(), code });
      track("signed_in", { via: "code", newUser: !me.memberId });
      router.replace(await afterSignIn(me, params));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu para entrar.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pb-8 pt-6 text-[17px]">
      {step === "email" ? <TopBar backHref="/" /> : <TopBar onBack={() => setStep("email")} />}
      <Logo size={30} variant="full" className="self-start" />

      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] leading-[1.08]">
              {invited ? `Oi, ${invited}. Entre com o seu e-mail.` : "Entre com o seu e-mail."}
            </h1>
            <p className="leading-relaxed text-muted">
              Mandamos um código para você entrar. Sem senha. É também por ele que chegam os avisos.
            </p>
          </div>
          <Field
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onValue={setEmail}
            autoFocus
          />
          {error ? (
            <p className="font-semibold text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-auto flex flex-col gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Enviando..." : "Receber o código"}
            </Button>
            <Link href="/family" className="py-2 text-center text-[15px] font-semibold text-brand">
              Só quero ver a demonstração
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] leading-[1.08]">Digite o código.</h1>
            <p className="leading-relaxed text-muted">
              Enviamos 6 números para <b className="text-ink">{email.trim()}</b>. Se preferir, toque no botão do e-mail.
            </p>
          </div>
          <Field
            label="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={code}
            onValue={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            className="[&_input]:text-center [&_input]:text-[28px] [&_input]:font-semibold [&_input]:tracking-[0.3em]"
            autoFocus
          />
          {error ? (
            <p className="font-semibold text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-auto flex flex-col gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Entrando..." : "Entrar"}
            </Button>
            <button type="button" onClick={() => sendCode()} disabled={busy} className="py-2 text-[15px] font-semibold text-brand">
              Mandar outro código
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
