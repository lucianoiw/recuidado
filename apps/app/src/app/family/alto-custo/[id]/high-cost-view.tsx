"use client";

import { useEffect, useState } from "react";
import {
  AlertIcon,
  Card,
  CheckIcon,
  Field,
  InfoIcon,
  NavigationIcon,
  TopBar,
} from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { track } from "@/lib/analytics";
import { getHighCost, saveHighCost, type HighCostItem, type HighCostPath, type HighCostRule } from "@/lib/api";
import { capitalize, formatCid } from "@/lib/programs";
import { dueText, formatDay } from "@/lib/high-cost";
import { formatDistance, mapsUrl } from "@/lib/pharmacies";
import { highCostUnits } from "@/lib/sus-units";
import { brl, medLabel } from "@/lib/use-family";
import { usePronouns } from "@/lib/pronouns";

const linkClass = "font-semibold text-brand underline underline-offset-2";

function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: HighCostItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="border-b border-line-soft last:border-b-0">
      <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
        <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-brand ${
            checked ? "border-brand bg-brand text-white" : "border-[#cfc8ba] bg-surface"
          }`}
        >
          {checked ? <CheckIcon size={18} strokeWidth={3} /> : null}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={checked ? "font-semibold text-muted line-through" : "font-semibold"}>{item.label}</span>
          {item.detail ? <span className="text-[15px] leading-snug text-muted">{item.detail}</span> : null}
          <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            {checked ? "Pronto" : "Falta"}
          </span>
        </span>
      </label>
    </li>
  );
}

function RuleRow({ rule, ela }: { rule: HighCostRule; ela: string }) {
  const status = rule.status ?? "missing";
  const look =
    status === "yes"
      ? { box: "bg-ok-soft text-ok", mark: <CheckIcon size={14} strokeWidth={2.8} />, label: `${ela} atende`, tone: "text-ok" }
      : status === "no"
        ? { box: "bg-danger-soft text-danger", mark: <XMark />, label: `${ela} não atende`, tone: "text-danger" }
        : { box: "bg-warn-soft text-warn", mark: <b className="text-[14px] leading-none">?</b>, label: "Confirme com o médico", tone: "text-warn" };
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${look.box}`}>{look.mark}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[16px] leading-snug">{capitalize(rule.text)}</span>
        <span className={`text-[14px] font-semibold ${look.tone}`}>{look.label}</span>
      </span>
    </li>
  );
}

function XMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Diseases the Alto Custo gives this medicine for, the CID codes the doctor writes on the LME and the rules. */
function WhoGetsIt({ med, ela }: { med: HighCostPath["medication"]; ela: string }) {
  const conditions = med.conditions ?? [];
  const rules = med.rules ?? [];
  if (conditions.length === 0 && rules.length === 0) return null;
  const codes = (med.conditionCodes ?? []).map(formatCid);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[18px] font-semibold">Para quem o Estado dá</h2>
      <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
        {conditions.length > 0 ? (
          <div className="flex flex-col gap-1">
            <ul className="flex flex-col gap-1">
              {conditions.map((c) => (
                <li key={c} className="text-[17px] font-semibold leading-snug">
                  {c}
                </li>
              ))}
            </ul>
            {codes.length > 0 ? (
              <span className="text-[14px] text-muted">
                CID no laudo: {codes.join(", ")}
              </span>
            ) : null}
          </div>
        ) : null}
        {rules.length > 0 ? (
          <ul className="flex flex-col gap-2.5 border-t border-line-soft pt-3">
            {rules.map((r) => (
              <RuleRow key={r.text} rule={r} ela={ela} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function Checklist({
  title,
  items,
  checked,
  onToggle,
}: {
  title: string;
  items: HighCostItem[];
  checked: string[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[18px] font-semibold">{title}</h2>
      <ul className="overflow-hidden rounded-card bg-surface">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} checked={checked.includes(item.id)} onToggle={() => onToggle(item.id)} />
        ))}
      </ul>
    </section>
  );
}

export function HighCostView({ id }: { id: string }) {
  const pr = usePronouns();
  const [path, setPath] = useState<HighCostPath | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = () =>
    getHighCost(id).then(
      (p) => {
        setPath(p);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );

  useEffect(() => {
    load();
    track("high_cost_path_opened", { medication_id: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="text-muted">{error}</p>;
  if (!path) return <p className="text-muted">Carregando...</p>;

  const { medication: med, guide, status } = path;
  const label = medLabel(med.name, med.strength);
  const renewal = status.stage === "renewal";
  const items = renewal ? guide.renewal : guide.firstRequest;

  async function save(body: Parameters<typeof saveHighCost>[1]) {
    setSaveError(null);
    try {
      await saveHighCost(id, body);
      await load();
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }

  function toggle(itemId: string) {
    const next = status.checked.includes(itemId)
      ? status.checked.filter((x) => x !== itemId)
      : [...status.checked, itemId];
    // Show it right away; the reload after saving brings the deadlines.
    setPath({ ...path!, status: { ...status, checked: next, done: next.length } });
    void save({ checked: next });
  }

  return (
    <>
      <TopBar backHref="/family/remedios">Alto Custo</TopBar>
      <PageTitle title={`${label} pelo Alto Custo`} subtitle="Farmácia de Alto Custo do Estado de São Paulo (CEAF)" />

      {!med.highCost ? (
        <Card tone="warn">Este remédio não está na lista do Alto Custo de São Paulo.</Card>
      ) : null}

      {med.monthlyCostCents > 0 ? (
        <Card tone="brand" className="flex flex-col gap-1">
          <span className="text-[15px]">Comprando, até {brl.format(med.monthlyCostCents / 100)} por mês (teto da CMED)</span>
          <b className="text-[22px] leading-tight text-brand">Pelo Alto Custo: R$ 0</b>
          <span className="text-[15px]">
            São até {brl.format((med.monthlyCostCents * 12) / 100)} por ano a menos para a família.
          </span>
        </Card>
      ) : null}

      <WhoGetsIt med={med} ela={pr.Ela} />

      {status.due ? (
        <section role="alert" className="flex items-start gap-2.5 rounded-card bg-warn-soft p-4">
          <AlertIcon size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-warn" />
          <b className="text-warn">{dueText(status.due)}</b>
        </section>
      ) : null}

      <p className="text-[15px] leading-snug">
        {(med.conditions?.length ?? 0) > 0 ? null : guide.disease ? (
          <>
            Pela cartilha da Secretaria da Saúde, para <b>{guide.disease}</b>.{" "}
          </>
        ) : (
          <>
            A lista de exames muda por remédio e doença. Confira na{" "}
            <a href={guide.pageUrl} target="_blank" rel="noreferrer" className={linkClass}>
              página do remédio na Secretaria
            </a>
            .{" "}
          </>
        )}
        {renewal
          ? `${pr.Ela} já recebe. Para continuar, a família entrega estes papéis na renovação.`
          : `${status.done} de ${status.total} itens prontos.`}
      </p>
      {/* The age rules above come from the same SES-SP page; the notes would say them twice. */}
      {((med.rules?.length ?? 0) > 0 ? [] : guide.notes).map((n) => (
        <p key={n} className="flex items-start gap-2 text-[15px] leading-snug text-muted">
          <InfoIcon size={18} className="mt-0.5 shrink-0" />
          {n}
        </p>
      ))}

      <Checklist
        title={renewal ? "1. Na consulta da renovação" : "1. Na consulta, o médico entrega"}
        items={items.filter((i) => i.who === "doctor")}
        checked={status.checked}
        onToggle={toggle}
      />
      <Checklist
        title="2. A família junta"
        items={items.filter((i) => i.who === "family")}
        checked={status.checked}
        onToggle={toggle}
      />
      {saveError ? <p className="text-[15px] font-semibold text-danger">{saveError}</p> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-semibold">3. Datas para não perder o prazo</h2>
        <Field
          type="date"
          label="Dia em que o médico preencheu o laudo LME"
          value={status.lmeFilledOn ?? ""}
          onValue={(v) => void save({ lmeFilledOn: v || null })}
          hint={
            status.lmeDeliverBy
              ? `O laudo vale ${guide.lmeValidDays} dias: entregar até ${formatDay(status.lmeDeliverBy)}.`
              : `O laudo vale ${guide.lmeValidDays} dias para pedir o remédio.`
          }
        />
        <Field
          type="date"
          label="Dia em que o pedido foi aprovado (ou da última renovação)"
          value={status.since ?? ""}
          onValue={(v) => void save({ since: v || null })}
          hint={
            status.renewBy
              ? `A cartilha pede laudo novo a cada ${guide.renewalMonths} meses: renovar até ${formatDay(status.renewBy)}. Confirme a data na farmácia.`
              : "A renovação é periódica. Confirme o prazo na farmácia ou na cartilha do remédio."
          }
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-semibold">4. Onde entregar e retirar</h2>
        <ul className="overflow-hidden rounded-card bg-surface">
          {highCostUnits.slice(0, 2).map((u) => (
            <li key={u.cnes} className="flex flex-col gap-2 border-b border-line-soft px-4 py-3.5 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <b className="leading-snug">{u.name}</b>
                <span className="whitespace-nowrap text-[15px] font-semibold text-muted">
                  {formatDistance(u.distanceKm)}
                </span>
              </div>
              <span className="text-[15px] leading-snug text-muted">
                {u.address}. {u.hours}.
              </span>
              <a
                href={mapsUrl(u)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-ink px-3.5 text-[15px] font-semibold text-ink no-underline"
              >
                <NavigationIcon size={18} />
                Como chegar
              </a>
            </li>
          ))}
        </ul>
        <p className="text-[15px] leading-snug">
          Antes de ir, veja se tem o remédio na{" "}
          <a href={guide.sources.stock} target="_blank" rel="noreferrer" className={linkClass}>
            consulta de estoque da Secretaria
          </a>
          .
        </p>
        <p className="text-[15px] leading-snug text-muted">
          Outra pessoa pode entregar e retirar por {pr.ela}. Leve: {guide.representative.join("; ").toLowerCase()}.
        </p>
      </section>

      <p className="flex items-start gap-2 text-[14px] leading-snug text-muted">
        <InfoIcon size={18} className="mt-0.5 shrink-0" />
        <span>
          O Recuidado só organiza o caminho. Quem avalia se {pr.ela} tem direito é o médico e a Secretaria da Saúde.
          Fontes:{" "}
          {guide.leafletUrl ? (
            <>
              <a href={guide.leafletUrl} target="_blank" rel="noreferrer" className={linkClass}>
                cartilha da SES-SP
              </a>
              {guide.updatedOn ? ` (atualizada em ${formatDay(guide.updatedOn)})` : ""},{" "}
            </>
          ) : null}
          <a href={guide.pageUrl} target="_blank" rel="noreferrer" className={linkClass}>
            página da Secretaria
          </a>
          ,{" "}
          <a href={guide.sources.ministry} target="_blank" rel="noreferrer" className={linkClass}>
            Ministério da Saúde
          </a>{" "}
          e{" "}
          <a href={guide.sources.lmeForm} target="_blank" rel="noreferrer" className={linkClass}>
            formulário LME
          </a>
          .
        </span>
      </p>
    </>
  );
}
