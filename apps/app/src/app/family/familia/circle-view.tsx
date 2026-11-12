"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { callName, deleteFamilyData, downloadFamilyData, getMe, setEmergencyContact, signOut, type Me, type Member } from "@/lib/api";
import { track } from "@/lib/analytics";
import { EnableNotifications } from "@/components/enable-notifications";
import Link from "next/link";
import { BellIcon, Button, CheckIcon, ChevronRightIcon, PhoneIcon, StatusPill, buttonClass, cn } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { useMe } from "@/lib/me";
import { useFamily } from "@/lib/use-family";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

export function CircleView() {
  const { data, error, reload } = useFamily();
  const [me, setMe] = useMe();

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const patient = callName(data.patient);
  const caregiver = data.caregivers.find((c) => c.id === me);

  return (
    <>
      <PageTitle title="Família" subtitle={`Quem cuida de ${patient}`} />

      {data.isDemo ? null : <SignedInAs />}

      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-extrabold">{data.isDemo ? "Quem é você na demonstração?" : "Quem cuida"}</h2>
        <ul className="overflow-hidden rounded-card border border-line-soft bg-surface" role={data.isDemo ? "radiogroup" : undefined}>
          {data.caregivers.map((c) => {
            const on = c.id === me;
            return (
              <li key={c.id} className="border-b border-line-soft last:border-b-0">
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    if (data.isDemo) setMe(c.id);
                  }}
                  className="flex min-h-16 w-full items-center gap-3 px-4 text-left"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[17px] font-extrabold text-brand"
                  >
                    {c.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b>{c.name}</b>
                    {c.relation ? (
                      <span className="text-[15px] text-muted">
                        {c.relation === "Outro" ? c.relationOther || "Outro" : c.relation}
                      </span>
                    ) : null}
                  </span>
                  {c.pending ? <StatusPill tone="warn">Convidado</StatusPill> : null}
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full",
                      on ? "bg-brand text-white" : "border-2 border-line",
                    )}
                  >
                    {on ? <CheckIcon size={16} strokeWidth={3} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <FirstContact caregivers={data.caregivers} patient={patient} onSaved={reload} />

      <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold">
          <BellIcon size={22} className="text-brand" />
          Alertas neste celular
        </h2>
        <p className="text-[15px] leading-snug text-muted">
          Se {patient} não confirmar o remédio, nem pelo app nem pela ligação, avisamos a família
          por notificação. Cada pessoa liga ou desliga no próprio celular.
        </p>
        {caregiver ? (
          <EnableNotifications
            key={caregiver.id}
            memberId={caregiver.id}
            label={`Ativar alertas para ${firstName(caregiver.name)}`}
          />
        ) : (
          <p className="text-[15px] font-semibold">Escolha acima quem é você.</p>
        )}
      </section>

      <Link
        href="/family/plano"
        className="flex items-center justify-between gap-3 rounded-card border border-line-soft bg-surface p-4 no-underline"
      >
        <span className="flex flex-col">
          <b>Plano</b>
          <span className="text-[15px] text-muted">Ligações para quem não usa celular</span>
        </span>
        <ChevronRightIcon size={20} className="text-muted" />
      </Link>

      <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
        <h2 className="text-[18px] font-extrabold">Convidar e instalar</h2>
        {data.isDemo ? null : (
          <Link href="/comecar?passo=3" className={buttonClass({ variant: "secondary" })}>
            Chamar mais alguém
          </Link>
        )}
        <Link href="/family/celular" className={buttonClass({ variant: "secondary" })}>
          Celular de {patient}
        </Link>
      </section>

      <YourData isDemo={Boolean(data.isDemo)} caregiver={caregiver} patient={patient} consent={data.patient} />
    </>
  );
}

/** Who gets the phone call when she reports an emergency. Calling everyone would cause alarm. */
function FirstContact({
  caregivers,
  patient,
  onSaved,
}: {
  caregivers: Member[];
  patient: string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(c: Member) {
    if (c.emergencyContact || saving) return;
    setSaving(c.id);
    setError(null);
    try {
      await setEmergencyContact(c.id);
      track("emergency_contact_changed");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar o primeiro contato.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
      <h2 className="flex items-center gap-2 text-[18px] font-extrabold">
        <PhoneIcon size={22} className="text-danger" />
        Primeiro contato
      </h2>
      <p className="text-[15px] leading-snug text-muted">
        Se {patient} disser na ligação que caiu, que sente dor no peito, falta de ar ou que desmaiou,
        ligamos primeiro para esta pessoa. Se ela não atender, ligamos para a próxima da família, uma de
        cada vez, até alguém ouvir o recado. Todas recebem a notificação.
      </p>
      <ul className="overflow-hidden rounded-2xl border border-line-soft" role="radiogroup" aria-label="Primeiro contato em emergência">
        {caregivers.map((c) => {
          const on = Boolean(c.emergencyContact);
          const noPhone = !c.hasPhone;
          return (
            <li key={c.id} className="border-b border-line-soft last:border-b-0">
              <button
                type="button"
                role="radio"
                aria-checked={on}
                disabled={noPhone || saving !== null}
                onClick={() => choose(c)}
                className="flex min-h-14 w-full items-center gap-3 px-4 text-left disabled:cursor-not-allowed"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className={noPhone ? "text-muted" : undefined}>{c.name}</b>
                  <span className="text-[15px] text-muted">
                    {noPhone ? "Sem celular cadastrado" : saving === c.id ? "Salvando..." : c.phone}
                  </span>
                  {on ? <span className="text-[15px] font-bold text-danger">Recebe a ligação</span> : null}
                </span>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    on ? "bg-brand text-white" : "border-2 border-line",
                  )}
                >
                  {on ? <CheckIcon size={16} strokeWidth={3} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="text-[15px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function consentText(p: Member, patient: string): string {
  if (p.consentSource === "patient") return `${patient} aceitou no app dela.`;
  if (p.consentSource === "caregiver") return `A família disse que ${patient} aceitou. Ela confirma no primeiro acesso ao app dela.`;
  return `${patient} ainda não aceitou. Sem o aceite dela, o Recuidado não liga.`;
}

/** LGPD rights: consent status, privacy notice, export and delete. */
function YourData({
  isDemo,
  caregiver,
  patient,
  consent,
}: {
  isDemo: boolean;
  caregiver: Member | undefined;
  patient: string;
  consent: Member;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = caregiver && !caregiver.invited;

  async function remove() {
    if (!caregiver) return;
    setBusy(true);
    setError(null);
    try {
      await deleteFamilyData();
      track("family_deleted");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para apagar os dados.");
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
      <h2 className="text-[18px] font-extrabold">Seus dados</h2>
      {isDemo ? null : <p className="text-[15px] leading-snug text-muted">{consentText(consent, patient)}</p>}
      <Link href="/privacidade" className={buttonClass({ variant: "secondary" })}>
        Como cuidamos dos dados
      </Link>
      {isDemo ? (
        <p className="text-[15px] leading-snug text-muted">
          Esta é a família de demonstração, com dados fictícios. Ela não pode ser baixada nem apagada.
        </p>
      ) : !owner ? (
        <p className="text-[15px] leading-snug text-muted">
          Quem fez o cadastro pode baixar ou apagar os dados da família aqui.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              track("family_export_clicked");
              downloadFamilyData().catch((e) => setError(e instanceof Error ? e.message : "Não deu para baixar os dados."));
            }}
            className={buttonClass({ variant: "secondary" })}
          >
            Baixar todos os dados
          </button>
          {confirming ? (
            <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-danger p-3.5" role="alertdialog">
              <p className="text-[15px] font-semibold leading-snug">
                Apagar {patient}, a família, os remédios, as doses e as ligações? Não tem volta.
              </p>
              <Button variant="danger" onClick={remove} disabled={busy}>
                {busy ? "Apagando..." : "Sim, apagar tudo"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="py-2 text-center text-[15px] font-bold text-danger"
            >
              Apagar a família e todos os dados
            </button>
          )}
          {error ? (
            <p className="text-[15px] font-semibold text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Who is signed in on this device, and the way out. */
function SignedInAs() {
  const router = useRouter();
  const [me, setMeInfo] = useState<Me | null>(null);
  useEffect(() => {
    getMe().then(setMeInfo, () => {});
  }, []);
  if (!me) return null;
  return (
    <section className="flex items-center justify-between gap-3 rounded-card border border-line-soft bg-surface p-4">
      <span className="flex min-w-0 flex-col">
        <b>Você entrou como {me.name ?? me.email}</b>
        <span className="truncate text-[15px] text-muted">{me.email}</span>
      </span>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/");
        }}
        className="min-h-11 shrink-0 rounded-xl border-[1.5px] border-ink px-3 text-[15px] font-bold"
      >
        Sair
      </button>
    </section>
  );
}
