"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { captureError, track } from "@/lib/analytics";
import { locateCep, lookupCep, type CepLookup } from "@/lib/cep";
import { AreaMap } from "@/components/area-map";
import { useCanShare } from "@/lib/origin";
import { inputClass } from "@/components/ui";
import { isCep, isDate, isEmail, isPhone, maskCep, maskDate, maskPhone } from "@/lib/masks";
import { getMe, getOnboarding, saveOnboarding } from "@/lib/api";
import { readSession } from "@/lib/session";
import {
  RELATIONS,
  emptyOnboarding,
  fromRecord,
  paymentOf,
  type Onboarding,
  type Relation,
} from "@/lib/onboarding";

const TOTAL = 3;


/** How the family calls the patient: a title and the first name ("Dona Maria"), or just the name. */
const TITLES = { female: ["Dona", "Senhora", "Doutora", ""], male: ["Seu", "Senhor", "Doutor", ""] } as const;
type Title = (typeof TITLES)["female" | "male"][number];

function titleOf(nickname: string, gender: "female" | "male"): Title {
  const first = nickname.trim().split(/\s+/)[0] ?? "";
  if (!nickname.trim()) return TITLES[gender][0];
  return (TITLES[gender] as readonly string[]).includes(first) ? (first as Title) : "";
}

function swapTitle(t: Title, gender: "female" | "male"): Title {
  const from = gender === "male" ? TITLES.female : TITLES.male;
  const i = (from as readonly string[]).indexOf(t);
  return i >= 0 ? TITLES[gender][i]! : t;
}

/** True when the family typed a name of its own ("Mariazinha"), which the buttons must keep. */
function typedByHand(p: { nickname: string; name: string }): boolean {
  const n = p.nickname.trim();
  return n !== "" && !(["female", "male"] as const).some((g) => TITLES[g].some((t) => callAs(t, p.name) === n));
}

function callAs(title: Title, name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return [title, first].filter(Boolean).join(" ");
}

export function OnboardingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  // Calls are the paid plan; without it the options say so instead of promising a call.
  const [calls, setCalls] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [data, setData] = useState<Onboarding>(emptyOnboarding);
  const [tried, setTried] = useState(false);
  const [cepOk, setCepOk] = useState(true);
  const [area, setArea] = useState<CepFound | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // The sign-up belongs to a signed-in e-mail. Without a session, sign in first.
    if (!readSession()) {
      router.replace("/entrar?next=/comecar");
      return;
    }
    let alive = true;
    getMe().then(
      (me) => {
        if (!alive) return;
        if (!me) {
          router.replace("/entrar?next=/comecar");
          return;
        }
        setEmail(me.email);
        setCalls(me.calls === true);
        // Restore the answers saved in an earlier visit ("Chamar mais alguém" opens step 3).
        if (!me.memberId) return;
        getOnboarding().then(
          (r) => {
            if (!alive || !r) return;
            setData(fromRecord(r));
            setFamilyId(r.familyId);
            if (params.get("passo") === "3") setStep(3);
          },
          () => {},
        );
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [params, router]);

  function patch<K extends keyof Onboarding>(key: K, value: Partial<Onboarding[K]>) {
    setData((d) => ({ ...d, [key]: { ...d[key], ...value } }));
  }

  const c = data.caregiver;
  const p = data.patient;
  const valid: Record<number, boolean> = {
    1: c.name.trim().length > 1 && isPhone(c.phone) && c.relation !== null && (c.relation !== "Outro" || c.relationOther.trim() !== ""),
    2: p.name.trim().length > 1 && isPhone(p.phone) && isDate(p.birth) && isCep(p.cep) && cepOk && p.consent,
    // Someone has to stay in the count.
    3: paymentOf(data).people.some((person) => !person.excluded),
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
        const saved = await saveOnboarding({ ...data, payment: paymentOf(data) });
        setFamilyId(saved.familyId);
      } catch (e) {
        captureError(e, { screen: "onboarding", step });
        setSaveError(e instanceof Error ? e.message : "Não deu para salvar o cadastro.");
        return;
      } finally {
        setSaving(false);
      }
    }
    track("onboarding_step_completed", { step, total: TOTAL });
    if (step < TOTAL) setStep(step + 1);
    else router.push(params.get("passo") === "3" ? "/family/familia" : "/family/adicionar");
  }

  const nickname = p.nickname.trim() || p.name.trim().split(" ")[0] || "ela";
  const she = p.gender === "male" ? "ele" : "ela";

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
            {email ? (
              <p className="text-[15px] leading-snug text-muted">
                Os avisos também chegam no seu e-mail, <b className="text-ink">{email}</b>.
              </p>
            ) : null}
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
            <Field
              label="Nome"
              value={p.name}
              onValue={(v) => patch("patient", { name: v, nickname: typedByHand(p) ? p.nickname : callAs(titleOf(p.nickname, p.gender), v) })}
              placeholder="Maria Helena"
              aria-invalid={tried && p.name.trim().length < 2}
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[15px] font-semibold">É ele ou ela?</legend>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: "female", label: "Ela" },
                  { value: "male", label: "Ele" },
                ] as const).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={p.gender === o.value}
                    onClick={() =>
                      patch("patient", {
                        gender: o.value,
                        nickname: typedByHand(p) ? p.nickname : callAs(swapTitle(titleOf(p.nickname, p.gender), o.value), p.name),
                      })
                    }
                    className={cn(
                      "min-h-12 rounded-2xl bg-surface p-3 text-[16px] font-semibold",
                      p.gender === o.value ? "border-2 border-brand bg-[#f2f8f6]" : "border-[1.5px] border-line-soft",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[15px] font-semibold">Como a família chama</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {TITLES[p.gender].map((t) => {
                  const on = p.nickname.trim() !== "" && p.nickname.trim() === callAs(t, p.name);
                  return (
                    <button
                      key={t || "nome"}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch("patient", { nickname: callAs(t, p.name) })}
                      className={cn(
                        "min-h-11 rounded-full px-4 text-[16px] font-semibold",
                        on ? "bg-ink text-white" : "border-[1.5px] border-line-soft bg-surface text-ink",
                      )}
                    >
                      {t || "Só o nome"}
                    </button>
                  );
                })}
              </div>
              <Field
                label="Nome na ligação e no app"
                value={p.nickname}
                onValue={(v) => patch("patient", { nickname: v })}
                placeholder="Dona Maria"
                autoComplete="off"
              />
              <span className="text-[14px] text-muted">
                Pode mudar, por exemplo para um apelido. A assistente começa com &ldquo;Oi,{" "}
                {p.nickname.trim() || "Dona Maria"}&rdquo; e fala &ldquo;{p.gender === "male" ? "o senhor" : "a senhora"}&rdquo;.
              </span>
            </fieldset>
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
              <CepField value={p.cep} onValue={(v) => patch("patient", { cep: v })} invalid={tried && !isCep(p.cep)} onLookup={setCepOk} onFound={setArea} />
            </div>
            {area && isCep(p.cep) ? <CepArea found={area} /> : null}
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[15px] font-semibold">Usa celular com internet?</legend>
              {[
                {
                  value: true,
                  title: "Sim, usa bem",
                  text: calls
                    ? "Lembrete no celular. Se não confirmar, a gente liga."
                    : "Lembrete no celular. Se não confirmar, a família é avisada.",
                },
                {
                  value: false,
                  title: "Não usa",
                  text: calls
                    ? "A gente liga no horário de cada remédio."
                    : "A ligação no horário do remédio é do plano pago, que chega em breve. Até lá, a família é avisada se a dose não for confirmada.",
                },
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
            <button
              type="button"
              role="checkbox"
              aria-checked={p.consent}
              aria-invalid={tried && !p.consent}
              onClick={() => patch("patient", { consent: !p.consent })}
              className={cn(
                "flex items-start gap-3 rounded-2xl bg-surface p-3.5 text-left",
                p.consent ? "border-2 border-brand bg-[#f2f8f6]" : tried ? "" : "border-[1.5px] border-line-soft",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-md",
                  p.consent ? "bg-brand text-white" : "border-2 border-[#8c8578]",
                )}
              >
                {p.consent ? <CheckIcon size={16} strokeWidth={3} /> : null}
              </span>
              <span className="text-[15px] leading-snug">
                Conversei com {nickname} e {she} aceita receber lembretes e ligações de uma assistente virtual, e que a
                família veja se {she} tomou o remédio.{p.usesPhone ? ` ${she === "ele" ? "Ele" : "Ela"} também confirma isso no app.` : ""}
              </span>
            </button>
            <Link href="/privacidade" className="text-[15px] font-semibold text-brand">
              Como cuidamos dos dados {she === "ele" ? "dele" : "dela"}
            </Link>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <InviteStep data={data} setData={setData} nickname={nickname} familyId={familyId} />
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
          {saving ? "Salvando..." : step === TOTAL ? (params.get("passo") === "3" ? "Salvar" : "Continuar, adicionar os remédios") : "Continuar"}
        </Button>
      </div>
    </main>
  );
}

function Header({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-[32px] leading-[1.08]">{title}</h1>
      {text ? <p className="leading-relaxed text-muted">{text}</p> : null}
    </div>
  );
}

function InviteStep({
  data,
  setData,
  nickname,
  familyId,
}: {
  data: Onboarding;
  setData: (fn: (d: Onboarding) => Onboarding) => void;
  nickname: string;
  familyId: string | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [relation, setRelation] = useState<Relation | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const canShare = useCanShare();
  const art = data.patient.gender === "male" ? "o" : "a";
  // Name and a way to reach the person: a valid e-mail or a valid phone, nothing typed wrong.
  const hasEmail = inviteEmail.trim() !== "";
  const ready =
    name.trim() !== "" &&
    (hasEmail || phone !== "") &&
    (!hasEmail || isEmail(inviteEmail)) &&
    (phone === "" || isPhone(phone));

  function add(): string | null {
    const who = name.trim();
    if (!ready) return null;
    setData((d) => ({ ...d, invites: [...d.invites, { name: who, phone, email: inviteEmail.trim(), relation }] }));
    setName("");
    setPhone("");
    setInviteEmail("");
    setRelation(null);
    setAdding(false);
    return who;
  }

  // The person opens it, signs in with their e-mail and takes the invite with their name.
  const link = (who: string) => {
    const url = new URL("/entrar", window.location.origin);
    if (familyId) url.search = new URLSearchParams({ convite: familyId, nome: who }).toString();
    return url.toString();
  };
  const message = (who: string) =>
    `${who}, estou cuidando dos remédios d${art} ${nickname} pelo Recuidado. Entra aqui para acompanhar junto: ${link(who)}`;

  async function send() {
    const who = add();
    if (who) await shareTo(who);
  }

  async function shareTo(who: string) {
    if (!canShare) {
      try {
        await navigator.clipboard.writeText(message(who));
        setDone(`Convite de ${who} copiado. Cole na conversa com a pessoa.`);
      } catch {}
      return;
    }
    try {
      // The phone's own share sheet: WhatsApp, SMS or e-mail, chosen by the user.
      await navigator.share({ title: "Convite do Recuidado", text: message(who) });
      setDone(`Convite enviado para ${who}.`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setDone(`${who} foi adicionado(a). Envie o convite quando quiser.`);
        return;
      }
      // Sharing blocked (a computer browser, or inside the two phones page): copy instead.
      try {
        await navigator.clipboard.writeText(message(who));
        setDone(`Convite de ${who} copiado. Cole na conversa com a pessoa.`);
      } catch {
        setDone(`Não deu para enviar daqui. Toque em Copiar convite em "Chamar mais alguém".`);
      }
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

  function later() {
    const email = inviteEmail.trim();
    const who = add();
    if (who) setDone(email ? `${who} foi adicionado(a). O convite vai para ${email} quando você continuar.` : `${who} foi adicionado(a). Envie o convite quando quiser.`);
  }

  const me = data.caregiver;
  return (
    <>
      <Header title="Quem cuida junto?" text="Todo mundo aqui recebe os alertas. Como dividir o que não é grátis vocês escolhem depois, em Onde comprar e dividir." />
      <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
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
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate">{i.name}</b>
              {i.relation ? <span className="text-[15px] text-muted">{i.relation}</span> : null}
            </span>
            <button
              type="button"
              onClick={() => shareTo(i.name)}
              aria-label={`${canShare ? "Enviar" : "Copiar"} o convite de ${i.name}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink"
            >
              {canShare ? <ShareIcon size={18} /> : <CopyIcon size={18} />}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#8c8578] font-semibold"
      >
        <PlusIcon size={20} />
        Chamar mais alguém
      </button>
      {done ? (
        <p aria-live="polite" className="flex items-center gap-2 text-[15px] font-semibold text-brand">
          <CheckIcon size={18} strokeWidth={2.6} />
          {done}
        </p>
      ) : null}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Chamar mais alguém">
        <Field label="Nome" value={name} onValue={setName} autoComplete="off" />
        <Field
          label="E-mail"
          hint="Mandamos o convite por e-mail. A pessoa entra com ele."
          type="email"
          inputMode="email"
          value={inviteEmail}
          onValue={setInviteEmail}
          placeholder="pessoa@exemplo.com"
          aria-invalid={inviteEmail.trim() !== "" && !isEmail(inviteEmail)}
        />
        <Field
          label="Celular"
          hint="Preencha o e-mail, o celular ou os dois."
          value={phone}
          onValue={setPhone}
          mask={maskPhone}
          inputMode="tel"
          placeholder="(11) 90000-0000"
          aria-invalid={phone !== "" && !isPhone(phone)}
        />
        <SelectField<Relation>
          label={`Quem é para ${art} ${nickname}?`}
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
            <Button onClick={send} disabled={!ready}>
              <ShareIcon size={20} />
              Enviar convite
            </Button>
          ) : null}
          <Button variant={canShare ? "secondary" : "primary"} onClick={copy} disabled={!ready}>
            <CopyIcon size={20} />
            Copiar convite
          </Button>
          <button
            type="button"
            onClick={later}
            disabled={!ready}
            className="min-h-12 font-semibold text-brand disabled:opacity-40"
          >
            {inviteEmail.trim() ? "Mandar o convite por e-mail" : "Só adicionar, envio depois"}
          </button>
        </div>
      </Sheet>
      <p className="flex gap-2.5 rounded-2xl bg-brand-soft p-3.5 text-[15px] leading-snug">
        <InfoIcon size={22} className="shrink-0 text-brand" />
        Toque no botão ao lado do nome para mandar o link. A pessoa abre e já acompanha {art} {nickname}.
      </p>
    </>
  );
}

/** How the family pays what is not free: split by Pix or one per month, and who stays out. */
function Avatar({ name, tone }: { name: string; tone: "brand" | "blue" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold",
        tone === "brand" ? "bg-blush text-accent-ink" : "bg-[#e8eef8] text-[#1e4e8c]",
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

type CepFound = Extract<CepLookup, { state: "found" }>;

/** Full-width address of the CEP and a thin map of the area where we look for pharmacies. */
function CepArea({ found }: { found: CepFound }) {
  const [point, setPoint] = useState<{ key: string; lat: number; lng: number } | null>(null);
  const key = [found.street, found.district, found.city, found.uf].join("|");

  useEffect(() => {
    const ctrl = new AbortController();
    locateCep(found, ctrl.signal).then((p) => {
      if (!ctrl.signal.aborted && p) setPoint({ key, ...p });
    });
    return () => ctrl.abort();
  }, [found, key]);

  const place = [found.street, found.district, `${found.city}/${found.uf}`].filter(Boolean).join(", ");
  return (
    <div className="-mt-1 flex flex-col gap-2">
      <p className="text-[15px] font-semibold leading-snug text-brand">{place}</p>
      {point?.key === key ? <AreaMap lat={point.lat} lng={point.lng} label={found.district || found.city} /> : null}
    </div>
  );
}

function CepField({
  value,
  onValue,
  invalid,
  onLookup,
  onFound,
}: {
  value: string;
  onValue: (v: string) => void;
  invalid: boolean;
  onLookup: (ok: boolean) => void;
  onFound: (found: CepFound | null) => void;
}) {
  const [lookup, setLookup] = useState<CepLookup>({ state: "idle" });

  useEffect(() => {
    if (!isCep(value)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookup({ state: "idle" });
      onLookup(true);
      onFound(null);
      return;
    }
    const ctrl = new AbortController();
    setLookup({ state: "loading" });
    lookupCep(value, ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      setLookup(r);
      onFound(r.state === "found" ? r : null);
      // A lookup that fails for network reasons does not block the form.
      onLookup(r.state !== "not-found");
    });
    return () => ctrl.abort();
  }, [value, onLookup, onFound]);

  const found = lookup.state === "found";
  const missing = lookup.state === "not-found";
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[15px] font-semibold">CEP</span>
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
      <span id="cep-status" aria-live="polite" className={cn("text-[14px] font-semibold", found ? "text-brand" : missing ? "text-danger" : "text-muted")}>
        {lookup.state === "not-found"
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
