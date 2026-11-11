"use client";

import { callName, joinFamily } from "@/lib/api";
import { CopyLinkButton } from "@/components/copy-button";
import { EnableNotifications } from "@/components/enable-notifications";
import Link from "next/link";
import { BellIcon, CheckIcon, StatusPill, buttonClass, cn } from "@/components/ui";
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

      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-extrabold">Quem é você?</h2>
        <ul className="overflow-hidden rounded-card border border-line-soft bg-surface" role="radiogroup">
          {data.caregivers.map((c) => {
            const on = c.id === me;
            return (
              <li key={c.id} className="border-b border-line-soft last:border-b-0">
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setMe(c.id);
                    // An invited person who picks their name has joined.
                    if (c.pending) joinFamily(c.id).then(reload, () => {});
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

      <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold">
          <BellIcon size={22} className="text-brand" />
          Alertas neste celular
        </h2>
        <p className="text-[15px] leading-snug text-muted">
          Se {patient} não confirmar o remédio, nem pelo app nem pela ligação, avisamos a família
          por notificação.
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

      <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
        <h2 className="text-[18px] font-extrabold">Convidar e instalar</h2>
        <CopyLinkButton path="/family" label="Copiar convite" />
        <Link href="/family/celular" className={buttonClass({ variant: "secondary" })}>
          Celular de {patient}
        </Link>
      </section>
    </>
  );
}
