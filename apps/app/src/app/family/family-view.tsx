"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertIcon,
  BellIcon,
  PillIcon,
  CameraIcon,
  Card,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DoseList,
  DoseRow,
  FreeIcon,
  HeartIcon,
  PhoneIcon,
  CartIcon,
  Notice,
  PinIcon,
  buttonClass,
  pillClass,
  type DoseStatus as RowStatus,
} from "@/components/ui";
import { DemoBanner } from "@/components/demo-banner";
import { CallLink } from "@/components/call-link";
import { callName, confirmDose, formatTime, isFree, type Dose } from "@/lib/api";
import { pronouns } from "@/lib/pronouns";
import { dueText } from "@/lib/high-cost";
import { stockText } from "@/lib/stock";
import { brl, medLabel, useFamily } from "@/lib/use-family";
import { useUnseenAlerts } from "@/lib/alerts-seen";

function rowStatus(d: Dose, now: number, ela: string): { status: RowStatus; text: string } {
  if (d.status === "taken") {
    const via = d.confirmedVia === "voice" ? " por ligação" : "";
    const at = d.confirmedAt ? ` ${formatTime(d.confirmedAt)}` : "";
    return { status: "taken", text: `Tomou${via}${at}` };
  }
  if (d.status === "missed") return { status: "missed", text: "Não tomou" };
  if (new Date(d.scheduledAt).getTime() <= now)
    // Time had passed when the medicine was added: her app asks her about it.
    return { status: "pending", text: d.beforeAdded ? `Perguntando a ${ela}` : "Esperando" };
  return { status: "upcoming", text: "Mais tarde" };
}

const tile =
  "flex min-h-[172px] flex-col gap-2 rounded-card bg-surface p-4 text-ink no-underline shadow-[0_1px_2px_rgba(22,19,20,0.04)]";

function todayLabel(): string {
  const t = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return t.charAt(0).toUpperCase() + t.slice(1).replace("-feira", "");
}

export function FamilyView() {
  const { data, error, now, reload } = useFamily();
  const [confirming, setConfirming] = useState<string | null>(null);
  const unseen = useUnseenAlerts();

  async function markTaken(group: Dose[]) {
    setConfirming(group[0].scheduledAt);
    try {
      await Promise.all(group.map((x) => confirmDose(x.id)));
      reload();
    } finally {
      setConfirming(null);
    }
  }

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const name = callName(data.patient);
  // One alert per time: doses at the same time are taken together.
  const missedByTime = new Map<string, Dose[]>();
  for (const d of data.today.filter((x) => x.status === "missed")) {
    missedByTime.set(d.scheduledAt, [
      ...(missedByTime.get(d.scheduledAt) ?? []),
      d,
    ]);
  }
  const missed = [...missedByTime.values()];
  const taken = data.today.filter((d) => d.status === "taken").length;
  // Free medicines the family gets for free save their CMED price; the others are bought.
  const getsFree = (m: (typeof data.medications)[number]) => isFree(m) && !m.buyInsteadOfFree;
  const savedCents = data.medications.filter(getsFree).reduce((sum, m) => sum + m.monthlyCostCents, 0);
  const costCents = data.medications.filter((m) => !getsFree(m)).reduce((sum, m) => sum + m.monthlyCostCents, 0);
  const pr = pronouns(data.patient.gender);
  const unwell = data.unwellReports?.[0];
  const runningOut = data.medications.filter((m) => m.stock?.low);
  const highCostDue = data.medications.filter((m) => m.highCostPath?.due);

  return (
    <>
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush text-[18px] font-semibold text-accent-ink"
        >
          {name.replace(/^(Dona|Seu)\s+/i, "").charAt(0)}
        </span>
        <span className="flex flex-1 flex-col leading-tight">
          <span className="text-[13px] text-muted">Família</span>
          <span className="text-[16px] font-semibold">{name}</span>
        </span>
        <Link
          href="/family/avisos"
          className="relative flex size-11 items-center justify-center rounded-full bg-surface shadow-[0_1px_2px_rgba(22,19,20,0.06)]"
        >
          <BellIcon size={22} />
          {unseen > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-semibold text-white"
            >
              {unseen > 9 ? "9+" : unseen}
            </span>
          ) : null}
          <span className="sr-only">{unseen > 0 ? `Avisos, ${unseen} ${unseen === 1 ? "novo" : "novos"}` : "Avisos"}</span>
        </Link>
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-[15px] text-muted">Hoje</span>
        <h1 className="font-display text-[34px] leading-[1.05]">{todayLabel()}</h1>
      </div>

      <DemoBanner isDemo={data.isDemo} />

      {unwell ? (
        <Notice
          role="alert"
          tone="warn"
          icon={<HeartIcon />}
          title={`${name} não está bem`}
          actions={
            <CallLink member={data.patient} className={pillClass("dark")}>
              <PhoneIcon />
              Ligar para {pr.ela}
            </CallLink>
          }
        >
          Na ligação das {formatTime(unwell.at)}
          {unwell.note ? (
            <>
              : <q>{unwell.note}</q>
            </>
          ) : (
            "."
          )}
          <span className="mt-1 block text-[13px] text-muted">{pr.Ela} mesm{pr.a} informou. O app não avalia a saúde {pr.dela}.</span>
        </Notice>
      ) : null}

      {missed.map((group) => {
        const d = group[0];
        const names = group.map((x) => medLabel(x.medicationName, x.strength));
        return (
          <Notice
            key={d.scheduledAt}
            role="alert"
            tone="danger"
            icon={<AlertIcon />}
            title={
              d.confirmedVia === "app"
                ? `${pr.Ela} disse que não tomou ${names.length > 1 ? "os remédios" : names[0]} das ${formatTime(d.scheduledAt)}`
                : `Não confirmou ${names.length > 1 ? "os remédios" : names[0]} das ${formatTime(d.scheduledAt)}`
            }
            actions={
              <>
                <CallLink member={data.patient} className={pillClass("dark")}>
                  <PhoneIcon />
                  Ligar para {pr.ela}
                </CallLink>
                <button
                  type="button"
                  onClick={() => markTaken(group)}
                  disabled={confirming === d.scheduledAt}
                  className={pillClass()}
                >
                  <CheckIcon />
                  {confirming === d.scheduledAt ? "Anotando..." : `${pr.Ela} já tomou`}
                </button>
              </>
            }
          >
            {names.length > 1 ? <span className="block">{names.join(", ")}</span> : null}
            <span className="block text-muted">
              {d.confirmedVia === "app" && d.confirmedAt
                ? `Respondeu no app às ${formatTime(d.confirmedAt)}.`
                : d.familyAlertedAt
                  ? `A família foi avisada às ${formatTime(d.familyAlertedAt)}.`
                  : `Vale ligar para ${pr.ela}.`}
            </span>
          </Notice>
        );
      })}

      {highCostDue.map((m) => (
        <Link key={m.id} href={`/family/alto-custo/${m.id}`} className="no-underline">
          <Notice tone="warn" icon={<AlertIcon />} title={`Alto Custo: ${medLabel(m.name, m.strength)}`}>
            <span className="flex items-start justify-between gap-2">
              {dueText(m.highCostPath!.due!)}
              <ChevronRightIcon size={20} className="shrink-0 text-muted" />
            </span>
          </Notice>
        </Link>
      ))}

      {runningOut.length > 0 ? (
        <Notice
          tone="warn"
          icon={<PillIcon />}
          title={runningOut.length > 1 ? "Remédios acabando" : "Remédio acabando"}
          actions={
            <Link
              href={runningOut.every(isFree) ? "/family/onde-pegar" : "/family/comprar"}
              className={pillClass()}
            >
              {runningOut.every(isFree) ? <PinIcon /> : <CartIcon />}
              {runningOut.every(isFree) ? "Onde pegar grátis" : "Onde comprar"}
            </Link>
          }
        >
          <ul className="flex flex-col gap-0.5">
            {runningOut.map((m) => (
              <li key={m.id}>
                <b>{medLabel(m.name, m.strength)}</b>: {stockText(m.stock!)}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <a href="#doses" className={tile}>
          <span className="text-[14px] text-muted">Doses de hoje</span>
          <span className="flex flex-wrap gap-1" aria-hidden="true">
            {data.today.map((d) => (
              <span
                key={d.id}
                className={
                  d.status === "taken"
                    ? "size-3.5 rounded-full bg-ink"
                    : d.status === "missed"
                      ? "size-3.5 rounded-full bg-accent"
                      : "size-3.5 rounded-full bg-line"
                }
              />
            ))}
          </span>
          <span className="mt-auto font-display text-[28px] leading-none">
            {taken}
            <span className="text-[16px] text-muted"> de {data.today.length}</span>
          </span>
          <span className="text-[14px] text-muted">tomadas</span>
        </a>
        <Link href="/family/avisos" className={tile}>
          <span className="text-[14px] text-muted">Avisos</span>
          <span className="flex size-10 items-center justify-center rounded-full bg-blush text-accent-ink">
            <BellIcon size={20} />
          </span>
          <span className="mt-auto font-display text-[28px] leading-none">{unseen}</span>
          <span className="text-[14px] text-muted">{unseen === 1 ? "novo" : "novos"}</span>
        </Link>
        <Link href="/family/mes" className={tile}>
          <span className="text-[14px] text-muted">Economia do mês</span>
          <span className="flex size-10 items-center justify-center rounded-full bg-blush text-accent-ink">
            <FreeIcon size={20} />
          </span>
          <span className="mt-auto font-display text-[26px] leading-none">{brl.format(savedCents / 100)}</span>
          <span className="text-[14px] leading-snug text-muted">
            {costCents > 0 ? `Comprar: até ${brl.format(costCents / 100)}` : "Nada para comprar"}
          </span>
        </Link>
        <Link href="/family/adicionar" className={tile}>
          <span className="text-[14px] text-muted">Remédios</span>
          <span className="flex size-10 items-center justify-center rounded-full bg-blush text-accent-ink">
            <CameraIcon size={20} />
          </span>
          <span className="mt-auto text-[17px] font-semibold leading-tight">Adicionar</span>
          <span className="text-[14px] leading-snug text-muted">Foto da receita ou um por um</span>
        </Link>
      </div>

      <section id="doses" className="flex scroll-mt-4 flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[24px]">Doses de hoje</h2>
          {data.today.length > 0 ? (
            <span className="text-[14px] text-muted">
              {taken} de {data.today.length} tomadas
            </span>
          ) : null}
        </div>
        {data.today.length === 0 && data.medications.length > 0 ? (
          <Card>
            <p className="text-muted">Nenhuma dose ainda. Os lembretes começam no próximo horário dos remédios.</p>
          </Card>
        ) : data.today.length === 0 ? (
          <Card className="flex flex-col gap-3">
            <p className="text-muted">
              Nenhuma dose hoje. Comece adicionando os remédios.
            </p>
            <Link href="/family/adicionar" className={buttonClass()}>
              <CameraIcon size={22} />
              Adicionar remédios
            </Link>
          </Card>
        ) : (
          <DoseList>
            {data.today.map((d) => {
              const s = rowStatus(d, now, pr.ela);
              return (
                <DoseRow
                  key={d.id}
                  name={medLabel(d.medicationName, d.strength)}
                  time={formatTime(d.scheduledAt)}
                  status={s.status}
                  statusText={s.text}
                />
              );
            })}
          </DoseList>
        )}
      </section>

      <Link
        href="/family/demo"
        className="flex items-center gap-3 rounded-full bg-ink py-3 pl-3 pr-5 text-white no-underline"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ClockIcon size={22} />
        </span>
        <span className="flex flex-1 flex-col leading-tight">
          <b className="font-semibold">Demo em 2 minutos</b>
          <span className="text-[14px] text-white/75">
            {data.calls === false ? "Lembrete e aviso, acelerados" : "Lembrete, ligação e aviso, acelerados"}
          </span>
        </span>
        <ChevronRightIcon size={20} />
      </Link>
    </>
  );
}
