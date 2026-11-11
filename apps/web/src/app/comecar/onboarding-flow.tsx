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
  Sheet,
  StatusPill,
  TopBar,
  buttonClass,
  cn,
} from "@/components/ui";
import { lookupCep, type CepLookup } from "@/lib/cep";
import { inputClass } from "@/components/ui";
import { isCep, isDate, isPhone, maskCep, maskDate, maskPhone } from "@/lib/masks";
import { getOnboarding, saveOnboarding } from "@/lib/api";
import { readMe, setMe } from "@/lib/me";
import {
  RELATIONS,
  emptyOnboarding,
  fromRecord,
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // Restore the answers this device's caregiver saved in an earlier visit.
    const me = readMe();
    if (!me) return;
    let alive = true;
    getOnboarding(me).then(
      (r) => {
        if (alive && r) setData(fromRecord(r));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
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

  async function next() {
    if (!valid[step]) {
      setTried(true);
      return;
    }
    setTried(false);
    // After steps 2 and 3, caregiver and patient are complete: save in the API.
    if (step === 2 || step === 3) {
      setSaving(true);
      setSaveError(null);
      try {
        const { caregiverId } = await saveOnboarding({ caregiverId: readMe(), ...data });
        setMe(caregiverId);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Não deu para salvar o cadastro.");
        return;
      } finally {
        setSaving(false);
      }
    }
    if (step < TOTAL) setStep(step + 1);
    else router.push("/family/receita");
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

      {saveError ? (
        <p className="font-semibold text-danger" role="alert">
          {saveError} Tente de novo.
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        <Button onClick={next} disabled={saving}>
          {saving ? "Salvando..." : step === TOTAL ? "Pronto, adicionar a receita" : "Continuar"}
        </Button>
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
  const [relation, setRelation] = useState<Relation | null>(null);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(who: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/family`);
      setCopied(who);
    } catch {}
  }

  function add() {
    const who = name.trim();
    if (!who) return;
    setData((d) => ({ ...d, invites: [...d.invites, { name: who, relation }] }));
    setName("");
    setRelation(null);
    setAdding(false);
    void copy(who);
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
      {copied ? (
        <p aria-live="polite" className="flex items-center gap-2 text-[15px] font-bold text-brand">
          <CheckIcon size={18} strokeWidth={2.6} />
          Convite de {copied} copiado. Cole na conversa com a pessoa.
        </p>
      ) : null}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Chamar mais alguém">
        <Field label="Nome" value={name} onValue={setName} autoComplete="off" />
        <SelectField<Relation>
          label={`Quem é para a ${nickname}?`}
          options={RELATIONS}
          value={relation}
          onValue={setRelation}
        />
        <p className="text-[15px] leading-snug text-muted">
          Depois de adicionar, o link do convite fica copiado. É só colar na conversa com a pessoa.
        </p>
        <Button onClick={add} disabled={!name.trim()}>
          <CopyIcon size={20} />
          Adicionar e copiar convite
        </Button>
      </Sheet>
      <p className="flex gap-2.5 rounded-2xl bg-brand-soft p-3.5 text-[15px] leading-snug">
        <InfoIcon size={22} className="shrink-0 text-brand" />
        Mande o link para quem você chamou. A pessoa abre e já acompanha a {nickname}.
      </p>
    </>
  );
}

function PatientLink() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/patient`);
      setCopied(true);
    } catch {}
  }
  return (
    <button type="button" onClick={copy} className={buttonClass({ variant: "secondary" })}>
      <CopyIcon size={20} />
      {copied ? "Link copiado" : "Copiar o link do app dela"}
    </button>
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
