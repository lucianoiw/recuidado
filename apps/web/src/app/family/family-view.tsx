"use client";

import Link from "next/link";
import {
  AlertIcon,
  BellIcon,
  PillIcon,
  CameraIcon,
  Card,
  ChevronRightIcon,
  ClockIcon,
  DoseList,
  DoseRow,
  HeartIcon,
  PhoneIcon,
  buttonClass,
  type DoseStatus as RowStatus,
} from "@/components/ui";
import { callName, formatTime, isFree, telHref, type Dose } from "@/lib/api";
import { stockText } from "@/lib/stock";
import { medLabel, useFamily } from "@/lib/use-family";

function rowStatus(d: Dose, now: number): { status: RowStatus; text: string } {
  if (d.status === "taken") {
    const via = d.confirmedVia === "voice" ? " por ligação" : "";
    const at = d.confirmedAt ? ` ${formatTime(d.confirmedAt)}` : "";
    return { status: "taken", text: `Tomou${via}${at}` };
  }
  if (d.status === "missed") return { status: "missed", text: "Não tomou" };
  if (new Date(d.scheduledAt).getTime() <= now)
    return { status: "pending", text: "Esperando" };
  return { status: "upcoming", text: "Mais tarde" };
}

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
  const { data, error, now } = useFamily();

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
  const free = data.medications.filter(isFree).length;
  const tel = telHref(data.patient);
  const unwell = data.unwellReports?.[0];
  const runningOut = data.medications.filter((m) => m.stock?.low);

  return (
    <>
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#f3dcc8] text-[19px] font-extrabold text-warn"
        >
          {name.replace(/^(Dona|Seu)\s+/i, "").charAt(0)}
        </span>
        <div className="flex flex-1 flex-col">
          <h1 className="text-[22px] font-extrabold leading-tight">{name}</h1>
          <span className="text-[15px] text-muted">{todayLabel()}</span>
        </div>
        <Link
          href="/family/avisos"
          className="flex size-11 items-center justify-center rounded-full border border-line-soft bg-surface"
        >
          <BellIcon size={22} />
          <span className="sr-only">Avisos</span>
        </Link>
      </header>

      {unwell ? (
        <section
          role="alert"
          className="flex flex-col gap-3 rounded-card border-[1.5px] border-warn bg-warn-soft p-4"
        >
          <div className="flex items-start gap-2.5">
            <HeartIcon size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-warn" />
            <div className="flex flex-col gap-0.5">
              <b className="text-warn">{name} não está bem</b>
              <span className="text-[15px] leading-snug">
                Na ligação das {formatTime(unwell.at)}
                {unwell.note ? (
                  <>
                    : <q className="font-semibold">{unwell.note}</q>
                  </>
                ) : (
                  "."
                )}
              </span>
              <span className="text-[14px] text-muted">
                Ela mesma contou. O app não avalia a saúde dela.
              </span>
            </div>
          </div>
          {tel ? (
            <a href={tel} className={buttonClass()}>
              <PhoneIcon size={20} />
              Ligar para ela
            </a>
          ) : null}
        </section>
      ) : null}

      {missed.map((group) => {
        const d = group[0];
        const names = group.map((x) => medLabel(x.medicationName, x.strength));
        return (
          <section
            key={d.scheduledAt}
            role="alert"
            className="flex flex-col gap-3 rounded-card border-[1.5px] border-danger bg-danger-soft p-4"
          >
            <div className="flex items-start gap-2.5">
              <AlertIcon
                size={22}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0 text-danger"
              />
              <div className="flex flex-col gap-0.5">
                <b className="text-danger">
                  Não confirmou {names.length > 1 ? "os remédios" : names[0]}{" "}
                  das {formatTime(d.scheduledAt)}
                </b>
                {names.length > 1 ? (
                  <span className="text-[15px] font-semibold">
                    {names.join(", ")}
                  </span>
                ) : null}
                <span className="text-[15px] leading-snug">
                  {d.familyAlertedAt
                    ? `A família foi avisada às ${formatTime(d.familyAlertedAt)}. Vale ligar para ela.`
                    : "Vale ligar para ela."}
                </span>
              </div>
            </div>
            {tel ? (
              <a href={tel} className={buttonClass({ variant: "danger" })}>
                <PhoneIcon size={20} />
                Ligar para ela
              </a>
            ) : null}
          </section>
        );
      })}

      {runningOut.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-card border-[1.5px] border-warn bg-warn-soft p-4">
          <div className="flex items-start gap-2.5">
            <PillIcon size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-warn" />
            <div className="flex flex-col gap-1">
              <b className="text-warn">
                {runningOut.length > 1 ? "Remédios acabando" : "Remédio acabando"}
              </b>
              <ul className="flex flex-col gap-0.5 text-[15px] leading-snug">
                {runningOut.map((m) => (
                  <li key={m.id}>
                    <b>{medLabel(m.name, m.strength)}</b>: {stockText(m.stock!)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Link
            href={runningOut.every(isFree) ? "/family/onde-pegar" : "/family/comprar"}
            className={buttonClass({ variant: "secondary" })}
          >
            {runningOut.every(isFree) ? "Ver onde pegar grátis" : "Ver onde comprar"}
          </Link>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[18px] font-extrabold">Doses de hoje</h2>
          {data.today.length > 0 ? (
            <span className="text-[14px] text-muted">
              {taken} de {data.today.length} tomadas
            </span>
          ) : null}
        </div>
        {data.today.length === 0 ? (
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
              const s = rowStatus(d, now);
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

      {data.medications.length > 0 ? (
        <section className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col gap-0.5">
            <span className="text-[14px] text-muted">
              Podem sair grátis
            </span>
            <span className="text-[26px] font-extrabold text-brand">
              {free} de {data.medications.length}
            </span>
            <span className="text-[13px] text-muted">remédios da receita</span>
          </Card>
          <Card className="flex flex-col gap-0.5">
            <span className="text-[14px] text-muted">Doses hoje</span>
            <span className="text-[26px] font-extrabold">
              {taken} de {data.today.length}
            </span>
            <span className="text-[13px] text-muted">confirmadas</span>
          </Card>
        </section>
      ) : null}

      <Link
        href="/family/adicionar"
        className="flex items-center gap-3 rounded-card border border-line-soft bg-surface p-4 no-underline"
      >
        <span className="flex size-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
          <CameraIcon size={24} />
        </span>
        <span className="flex flex-1 flex-col">
          <b>Adicionar remédios</b>
          <span className="text-[15px] text-muted">
            Foto da receita ou um por um
          </span>
        </span>
        <ChevronRightIcon size={20} className="text-muted" />
      </Link>

      <Link
        href="/family/demo"
        className="flex items-center gap-3 rounded-card border border-line-soft bg-surface p-4 no-underline"
      >
        <span className="flex size-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
          <ClockIcon size={24} />
        </span>
        <span className="flex flex-1 flex-col">
          <b>Demo em 2 minutos</b>
          <span className="text-[15px] text-muted">
            Lembrete, ligação e aviso, acelerados
          </span>
        </span>
        <ChevronRightIcon size={20} className="text-muted" />
      </Link>
    </>
  );
}
