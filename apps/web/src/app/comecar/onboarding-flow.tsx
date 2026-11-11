"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Button,
  CheckIcon,
  CopyIcon,
  Field,
  InfoIcon,
  PlusIcon,
  SelectField,
  ShareIcon,
  Sheet,
  StatusPill,
  TopBar,
  cn,
} from "@/components/ui";
import { QRCodeSVG } from "qrcode.react";
import { lookupCep, type CepLookup } from "@/lib/cep";
import { useCanShare, useOrigin } from "@/lib/origin";
import { inputClass } from "@/components/ui";
import { isCep, isDate, isPhone, maskCep, maskDate, maskPhone } from "@/lib/masks";
import {
  RELATIONS,
  emptyOnboarding,
  loadOnboarding,
  saveOnboarding,
  type Onboarding,
  type Relation,
} from "@/lib/onboarding";

const TOTAL = 4;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Onboarding>(emptyOnboarding);
  const [tried, setTried] = useState(false);
  const [cepOk, setCepOk] = useState(true);

  useEffect(() => {
    const saved = loadOnboarding();
    // Restore answers from an earlier visit (browser only, see lib/onboarding.ts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setData(saved);
  }, []);

  function patch<K extends keyof Onboarding>(key: K, value: Partial<Onboarding[K]>) {
    setData((d) => ({ ...d, [key]: { ...d[key], ...value } }));
  }

  const c = data.caregiver;
  const p = data.patient;
  const valid: Record<number, boolean> = {
    1: c.name.trim().length > 1 && isPhone(c.phone) && c.relation !== null && (c.relation !== "Outro" || c.relationOther.trim() !== ""),
    2: p.name.trim().length > 1 && isPhone(p.phone) && isDate(p.birth) && isCep(p.cep) && cepOk,
    3: true,
    4: true,
  };

  function next() {
    if (!valid[step]) {
      setTried(true);
      return;
    }
    setTried(false);
    saveOnboarding(data);
    if (step < TOTAL) setStep(step + 1);
    else router.push("/family/adicionar");
  }

  const nickname = p.nickname.trim() || p.name.trim().split(" ")[0] || "ela";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pb-8 pt-6 text-[17px]">
      {step === 1 ? (
        <TopBar backHref="/" step={1} total={TOTAL} />
      ) : (
        <TopBar onBack={() => setStep(step - 1)} step={step} total={TOTAL} />
      )}

      {step === 1 ? (
        <>
          <Header title="Primeiro, você." text="É para cá que vão os avisos sobre os remédios." />
          <div className="flex flex-col gap-4">
            <Field label="Seu nome" autoComplete="given-name" value={c.name} onValue={(v) => patch("caregiver", { name: v })} aria-invalid={tried && c.name.trim().length < 2} />
            <Field
              label="Celular"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 90000-0000"
              mask={maskPhone}
              value={c.phone}
              onValue={(v) => patch("caregiver", { phone: v })}
              aria-invalid={tried && !isPhone(c.phone)}
            />
            <SelectField<Relation>
              label="Quem é você para a pessoa cuidada?"
              options={RELATIONS}
              value={c.relation}
              onValue={(v) => patch("caregiver", { relation: v })}
              invalid={tried && c.relation === null}
            />
            {c.relation === "Outro" ? (
              <Field label="Qual?" value={c.relationOther} onValue={(v) => patch("caregiver", { relationOther: v })} />
            ) : null}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Header title="Quem vamos cuidar?" />
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" value={p.name} onValue={(v) => patch("patient", { name: v })} placeholder="Maria Helena" aria-invalid={tried && p.name.trim().length < 2} />
              <Field label="Como chamar" value={p.nickname} onValue={(v) => patch("patient", { nickname: v })} placeholder="Dona Maria" />
            </div>
            <Field
              label="Telefone, para a ligação"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              mask={maskPhone}
              value={p.phone}
              onValue={(v) => patch("patient", { phone: v })}
              aria-invalid={tried && !isPhone(p.phone)}
            />
            <div className="grid grid-cols-2 items-start gap-3">
              <Field label="Nascimento" inputMode="numeric" placeholder="dd/mm/aaaa" mask={maskDate} value={p.birth} onValue={(v) => patch("patient", { birth: v })} aria-invalid={tried && !isDate(p.birth)} />
              <CepField value={p.cep} onValue={(v) => patch("patient", { cep: v })} invalid={tried && !isCep(p.cep)} onLookup={setCepOk} />
            </div>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[15px] font-bold">Usa celular com internet?</legend>
              {[
                { value: true, title: "Sim, usa bem", text: "Lembrete no celular. Se não confirmar, a gente liga." },
                { value: false, title: "Não usa", text: "A gente liga no horário de cada remédio." },
              ].map((o) => (
                <button
                  key={o.title}
                  type="button"
                  role="radio"
                  aria-checked={p.usesPhone === o.value}
                  onClick={() => patch("patient", { usesPhone: o.value })}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl bg-surface p-3.5 text-left",
                    p.usesPhone === o.value ? "border-2 border-brand bg-[#f2f8f6]" : "border-[1.5px] border-line-soft",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 size-[22px] shrink-0 rounded-full",
                      p.usesPhone === o.value ? "border-[7px] border-brand" : "border-2 border-[#8c8578]",
                    )}
                  />
                  <span className="flex flex-col gap-0.5">
                    <b>{o.title}</b>
                    <span className="text-[15px] text-muted">{o.text}</span>
                  </span>
                </button>
              ))}
            </fieldset>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <InviteStep data={data} setData={setData} nickname={nickname} />
      ) : null}

      {step === 4 ? (
        <>
          <Header title={`Agora, o celular da ${nickname}.`} text="Leva 1 minuto. Faça junto ou na próxima visita." />
          <PatientLink />
          <ol className="flex flex-col gap-3.5">
            {["Abra o link no celular dela.", "Toque em Adicionar à Tela de Início.", "Toque em Permitir as notificações."].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-extrabold text-white">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
          {!p.usesPhone ? (
            <p className="rounded-2xl bg-brand-soft p-3.5 text-[15px] leading-snug">
              Ela não usa celular? Tudo bem: a gente liga no horário de cada remédio.
            </p>
          ) : null}
        </>
      ) : null}

      {tried && !valid[step] ? (
        <p className="font-semibold text-danger" role="alert">
          Confira os campos marcados.
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        <Button onClick={next}>{step === TOTAL ? "Pronto, adicionar os remédios" : "Continuar"}</Button>
        {step === TOTAL ? (
          <Link href="/family" className="py-3 text-center font-bold text-brand">
            Fazer depois
          </Link>
        ) : null}
      </div>
    </main>
  );
}

function Header({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {text ? <p className="leading-relaxed text-muted">{text}</p> : null}
    </div>
  );
}

function InviteStep({
  data,
  setData,
  nickname,
}: {
  data: Onboarding;
  setData: (fn: (d: Onboarding) => Onboarding) => void;
  nickname: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState<Relation | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const canShare = useCanShare();

  function add(): string | null {
    const who = name.trim();
    if (!who || (phone && !isPhone(phone))) return null;
    setData((d) => ({ ...d, invites: [...d.invites, { name: who, phone, relation }] }));
    setName("");
    setPhone("");
    setRelation(null);
    setAdding(false);
    return who;
  }

  const link = () => `${window.location.origin}/family`;
  const message = (who: string) =>
    `${who}, estou cuidando dos remédios da ${nickname} pelo Recuidado. Entra aqui para acompanhar junto: ${link()}`;

  async function send() {
    const who = add();
    if (!who) return;
    try {
      // The phone's own share sheet: WhatsApp, SMS or e-mail, chosen by the user.
      await navigator.share({ title: "Convite do Recuidado", text: message(who) });
      setDone(`Convite enviado para ${who}.`);
    } catch {
      setDone(`${who} foi adicionado(a). Envie o convite quando quiser.`);
    }
  }

  async function copy() {
    const who = add();
    if (!who) return;
    try {
      await navigator.clipboard.writeText(message(who));
      setDone(`Convite de ${who} copiado. Cole na conversa com a pessoa.`);
    } catch {
      setDone(`${who} foi adicionado(a).`);
    }
  }

  const me = data.caregiver;
  return (
    <>
      <Header title="Quem cuida junto?" text="Todo mundo aqui recebe os alertas e divide o custo do que não é grátis." />
      <ul className="flex flex-col overflow-hidden rounded-card border border-line-soft bg-surface">
        <li className="flex items-center gap-3 px-4 py-3.5">
          <Avatar name={me.name || "Você"} tone="brand" />
          <span className="flex flex-1 flex-col">
            <b>{me.name || "Você"}</b>
            <span className="text-[15px] text-muted">{me.relation === "Outro" ? me.relationOther : me.relation}, você</span>
          </span>
          <StatusPill tone="ok">Na família</StatusPill>
        </li>
        {data.invites.map((i) => (
          <li key={i.name} className="flex items-center gap-3 border-t border-line-soft px-4 py-3.5">
            <Avatar name={i.name} tone="blue" />
            <span className="flex flex-1 flex-col">
              <b>{i.name}</b>
              {i.relation ? <span className="text-[15px] text-muted">{i.relation}</span> : null}
            </span>
            <StatusPill tone="warn">Convite pronto</StatusPill>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#8c8578] font-bold"
      >
        <PlusIcon size={20} />
        Chamar mais alguém
      </button>
      {done ? (
        <p aria-live="polite" className="flex items-center gap-2 text-[15px] font-bold text-brand">
          <CheckIcon size={18} strokeWidth={2.6} />
          {done}
        </p>
      ) : null}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Chamar mais alguém">
        <Field label="Nome" value={name} onValue={setName} autoComplete="off" />
        <Field
          label="Celular"
          value={phone}
          onValue={setPhone}
          mask={maskPhone}
          inputMode="tel"
          placeholder="(11) 90000-0000"
          aria-invalid={phone !== "" && !isPhone(phone)}
        />
        <SelectField<Relation>
          label={`Quem é para a ${nickname}?`}
          options={RELATIONS}
          value={relation}
          onValue={setRelation}
        />
        {canShare ? (
          <p className="text-[15px] leading-snug text-muted">
            &quot;Enviar convite&quot; abre as opções do celular: WhatsApp, SMS ou e-mail.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {canShare ? (
            <Button onClick={send} disabled={!name.trim()}>
              <ShareIcon size={20} />
              Enviar convite
            </Button>
          ) : null}
          <Button variant={canShare ? "secondary" : "primary"} onClick={copy} disabled={!name.trim()}>
            <CopyIcon size={20} />
            Copiar convite
          </Button>
        </div>
      </Sheet>
      <p className="flex gap-2.5 rounded-2xl bg-brand-soft p-3.5 text-[15px] leading-snug">
        <InfoIcon size={22} className="shrink-0 text-brand" />
        Mande o link para quem você chamou. A pessoa abre e já acompanha a {nickname}.
      </p>
    </>
  );
}

function PatientLink() {
  const origin = useOrigin();
  const url = `${origin}/patient`;
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {}
  }
  return (
    <section className="flex items-stretch gap-4 rounded-card border border-line-soft bg-surface p-4">
      <span className="flex size-[132px] shrink-0 items-center justify-center rounded-xl border border-line bg-white p-2">
        {origin ? (
          <QRCodeSVG value={url} size={114} fgColor="#16201f" title="QR code do app dela" />
        ) : null}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5">
        <p className="text-[16px] leading-snug">Aponte a câmera do celular dela para o código.</p>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-surface text-[16px] font-bold"
        >
          <CopyIcon size={18} />
          <span aria-live="polite">{copied ? "Copiado" : "Copiar link"}</span>
        </button>
      </div>
    </section>
  );
}

function Avatar({ name, tone }: { name: string; tone: "brand" | "blue" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold",
        tone === "brand" ? "bg-brand-soft text-brand" : "bg-[#e8eef8] text-[#1e4e8c]",
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function CepField({
  value,
  onValue,
  invalid,
  onLookup,
}: {
  value: string;
  onValue: (v: string) => void;
  invalid: boolean;
  onLookup: (ok: boolean) => void;
}) {
  const [lookup, setLookup] = useState<CepLookup>({ state: "idle" });

  useEffect(() => {
    if (!isCep(value)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookup({ state: "idle" });
      onLookup(true);
      return;
    }
    const ctrl = new AbortController();
    setLookup({ state: "loading" });
    lookupCep(value, ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      setLookup(r);
      // A lookup that fails for network reasons does not block the form.
      onLookup(r.state !== "not-found");
    });
    return () => ctrl.abort();
  }, [value, onLookup]);

  const found = lookup.state === "found";
  const missing = lookup.state === "not-found";
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[15px] font-bold">CEP</span>
      <span className="relative">
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={value}
          onChange={(e) => onValue(maskCep(e.target.value))}
          aria-invalid={invalid || missing}
          aria-describedby="cep-status"
          className={cn(inputClass, "pr-11", found && "border-brand")}
        />
        {found || missing ? (
          <span
            className={cn(
              "absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-white",
              found ? "bg-brand" : "bg-danger",
            )}
          >
            {found ? <CheckIcon size={14} /> : <XIcon />}
          </span>
        ) : null}
      </span>
      <span id="cep-status" aria-live="polite" className={cn("text-[14px] font-bold", found ? "text-brand" : missing ? "text-danger" : "text-muted")}>
        {lookup.state === "found"
          ? [lookup.district, `${lookup.city}/${lookup.uf}`].filter(Boolean).join(", ")
          : lookup.state === "not-found"
            ? "CEP não encontrado"
            : lookup.state === "loading"
              ? "Procurando..."
              : lookup.state === "error"
                ? "Não deu para conferir agora"
                : ""}
      </span>
    </label>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
