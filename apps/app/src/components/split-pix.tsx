"use client";

import { useState } from "react";
import { Button, CheckIcon, CopyIcon, Field, Segmented, StatusPill, buttonClass } from "@/components/ui";
import { setPayment, setPixKey, setSharePaid, type MonthShare, type MonthSummary, type PixKeyType, type SplitMode } from "@/lib/api";
import { PaymentSetup, type PaymentPerson } from "@/components/payment-setup";
import { maskPhone } from "@/lib/masks";
import { useMe } from "@/lib/me";
import { brl } from "@/lib/use-family";

const KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "phone", label: "Celular" },
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Aleatória" },
];

const KEY_HINT: Record<PixKeyType, string> = {
  phone: "(11) 91234-5678",
  cpf: "000.000.000-00",
  email: "nome@email.com",
  random: "Chave aleatória do seu banco",
};

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function CopyPix({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }
  return (
    <button type="button" onClick={copy} className={buttonClass({ variant: "primary" })}>
      <CopyIcon size={20} />
      <span aria-live="polite">{copied ? "Pix copiado. Cole no app do banco" : "Copiar Pix"}</span>
    </button>
  );
}

function ShareRow({
  share,
  me,
  receiverName,
  onChanged,
}: {
  share: MonthShare;
  me: string | null;
  receiverName: string | null;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function mark(paid: boolean) {
    setSaving(true);
    try {
      await setSharePaid(share.memberId, paid);
      onChanged();
    } finally {
      setSaving(false);
    }
  }
  const status = share.isReceiver
    ? { tone: "neutral" as const, text: "Compra e recebe" }
    : share.paid
      ? { tone: "ok" as const, text: "Pagou" }
      : { tone: "warn" as const, text: "Falta pagar" };
  return (
    <li className="flex flex-col gap-3 border-b border-line-soft py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[15px] font-extrabold text-brand"
        >
          {initial(share.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span>
            {share.name}
            {share.memberId === me ? " (você)" : ""}
          </span>
          <b>{brl.format(share.amountCents / 100)}</b>
        </span>
        <StatusPill tone={status.tone}>
          {share.paid && !share.isReceiver ? <CheckIcon size={16} className="mr-1" /> : null}
          {status.text}
        </StatusPill>
      </div>
      {!share.isReceiver && share.amountCents > 0 ? (
        share.paid ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => mark(false)}
            className="w-fit text-[15px] font-bold text-muted underline"
          >
            Desfazer pagamento
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            {share.pix ? <CopyPix code={share.pix} /> : null}
            <Button variant="secondary" disabled={saving} onClick={() => mark(true)}>
              {share.memberId === me ? "Já paguei" : `${share.name} já pagou`}
              {receiverName ? ` a ${receiverName}` : ""}
            </Button>
          </div>
        )
      ) : null}
    </li>
  );
}

function ReceiverForm({ me, onSaved }: { me: string; onSaved: () => void }) {
  const [type, setType] = useState<PixKeyType>("phone");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    setError(null);
    try {
      await setPixKey(me, { type, key });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar a chave Pix.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Segmented label="Tipo de chave Pix" options={KEY_TYPES} value={type} onChange={setType} />
      <Field
        label="Sua chave Pix"
        placeholder={KEY_HINT[type]}
        value={key}
        inputMode={type === "phone" || type === "cpf" ? "numeric" : type === "email" ? "email" : "text"}
        mask={type === "phone" ? maskPhone : undefined}
        aria-invalid={error ? true : undefined}
        onValue={setKey}
        hint={error ?? "Fica salva só para a sua família ver."}
      />
      <Button disabled={saving || key.trim().length === 0} onClick={save}>
        Eu compro e recebo o Pix
      </Button>
    </div>
  );
}

function monthOnly(label: string): string {
  return label.split(" de ")[0] ?? label;
}

/** Edits how the family pays: split or rotation, the order, and who stays out of the count. */
function PaymentForm({ month, me, onDone }: { month: MonthSummary; me: string | null; onDone: (saved: boolean) => void }) {
  const [mode, setMode] = useState<SplitMode>(month.split.mode);
  const [people, setPeople] = useState<PaymentPerson[]>(
    month.split.people.map((p) => ({
      key: p.memberId,
      name: p.name,
      excluded: p.excluded,
      reason: p.excludedReason,
      me: p.memberId === me,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    setError(null);
    try {
      await setPayment({ mode, members: people.map((p) => ({ id: p.key, excluded: p.excluded, reason: p.reason ?? null })) });
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col gap-3 border-t border-line-soft pt-3">
      <PaymentSetup
        mode={mode}
        people={people}
        monthName={monthOnly(month.label)}
        withReason
        onChange={(m, list) => {
          setMode(m);
          setPeople(list);
        }}
      />
      {error ? <p className="text-[15px] font-bold text-danger">{error}</p> : null}
      <Button disabled={saving || people.every((p) => p.excluded)} onClick={save}>
        {saving ? "Salvando..." : "Salvar"}
      </Button>
      <button type="button" onClick={() => onDone(false)} className="w-fit text-[15px] font-bold text-muted underline">
        Cancelar
      </button>
    </div>
  );
}

/** Rotation: who buys this month, "Já comprei", and the next months. */
function Rotation({ month, me, onChanged }: { month: MonthSummary; me: string | null; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const rotation = month.split.rotation!;
  const share = month.split.shares[0];
  const payer = rotation.payer;
  async function mark(paid: boolean) {
    if (!payer) return;
    setSaving(true);
    try {
      await setSharePaid(payer.id, paid);
      onChanged();
    } finally {
      setSaving(false);
    }
  }
  if (!payer || !share) return <p className="text-[15px] text-muted">Ninguém na fila. Coloque alguém na conta.</p>;
  const isMe = payer.id === me;
  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3.5">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-[17px] font-extrabold text-white"
        >
          {initial(payer.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] text-muted">Vez de comprar em {monthOnly(month.label)}</span>
          <b className="text-[19px]">
            {payer.name}
            {isMe ? " (você)" : ""}
          </b>
        </span>
        <StatusPill tone={share.paid ? "ok" : "warn"}>
          {share.paid ? <CheckIcon size={16} className="mr-1" /> : null}
          {share.paid ? "Comprou" : "Falta comprar"}
        </StatusPill>
      </div>
      {share.paid ? (
        <button type="button" disabled={saving} onClick={() => mark(false)} className="w-fit text-[15px] font-bold text-muted underline">
          Desfazer
        </button>
      ) : (
        <Button variant="secondary" disabled={saving} onClick={() => mark(true)}>
          {isMe ? "Já comprei" : `${payer.name} já comprou`}
        </Button>
      )}
      {rotation.schedule.length > 1 ? (
        <ul className="flex flex-col">
          {rotation.schedule.slice(1).map((s) => (
            <li key={s.month} className="flex items-center justify-between gap-3 border-b border-line-soft py-2.5 last:border-b-0">
              <span className="text-muted">{s.label.charAt(0).toUpperCase() + monthOnly(s.label).slice(1)}</span>
              <b>
                {s.name}
                {s.memberId === me ? " (você)" : ""}
              </b>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** People out of the count, with the reason the family wrote. */
function OutOfCount({ month }: { month: MonthSummary }) {
  const out = month.split.people.filter((p) => p.excluded);
  if (out.length === 0) return null;
  return (
    <p className="text-[15px] leading-snug text-muted">
      Fora da conta:{" "}
      {out.map((p, i) => (
        <span key={p.memberId}>
          {i > 0 ? ", " : ""}
          <b className="text-ink">{p.name}</b>
          {p.excludedReason ? ` (${p.excludedReason})` : ""}
        </span>
      ))}
      .
    </p>
  );
}

/**
 * This month's cost: split with a Pix "copia e cola" for each share, or one caregiver buys it all
 * (rotation). Who already paid, and the form to change how the family pays.
 */
export function SplitPix({ month, isDemo, onChanged }: { month: MonthSummary; isDemo: boolean; onChanged: () => void }) {
  const [me] = useMe();
  const [changingKey, setChangingKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const { receiver, shares, mode } = month.split;
  const meIsCaregiver = month.split.people.some((p) => p.memberId === me);
  const left = shares.filter((s) => !s.paid).reduce((sum, s) => sum + s.amountCents, 0);
  const rotation = mode === "rotation";

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-extrabold">{rotation ? "Cada mês um compra" : "Dividir entre a família"}</h2>
        <span className="text-[18px] font-extrabold">{brl.format(month.costCents / 100)}</span>
      </div>

      {rotation ? (
        <Rotation month={month} me={me} onChanged={onChanged} />
      ) : (
        <>
          <p className="text-[15px] leading-snug text-muted">
            {receiver
              ? `${receiver.name} compra os remédios de ${month.label}. Cada um manda a sua parte por Pix.`
              : "Quem compra os remédios recebe a parte dos outros por Pix."}
          </p>

          <ul className="flex flex-col">
            {shares.map((s) => (
              <ShareRow key={s.memberId} share={s} me={me} receiverName={receiver?.name ?? null} onChanged={onChanged} />
            ))}
          </ul>

          {receiver ? (
            <StatusPill tone={left > 0 ? "warn" : "ok"} className="w-fit">
              {left > 0 ? `Falta receber ${brl.format(left / 100)}` : "Tudo pago este mês"}
            </StatusPill>
          ) : null}
        </>
      )}

      <OutOfCount month={month} />

      {rotation ? null : isDemo ? (
        <p className="text-[14px] leading-snug text-muted">
          Na demonstração a chave Pix é fictícia: o código não leva dinheiro a ninguém.
        </p>
      ) : meIsCaregiver && me && (!receiver || changingKey) ? (
        <ReceiverForm
          me={me}
          onSaved={() => {
            setChangingKey(false);
            onChanged();
          }}
        />
      ) : meIsCaregiver && receiver ? (
        <button
          type="button"
          onClick={() => setChangingKey(true)}
          className="w-fit text-[15px] font-bold text-brand underline"
        >
          {receiver.id === me ? "Mudar minha chave Pix" : "Eu compro este mês e recebo o Pix"}
        </button>
      ) : null}

      {editing ? (
        <PaymentForm
          month={month}
          me={me}
          onDone={(saved) => {
            setEditing(false);
            if (saved) onChanged();
          }}
        />
      ) : month.split.people.length > 1 ? (
        <button type="button" onClick={() => setEditing(true)} className="w-fit text-[15px] font-bold text-brand underline">
          Mudar como vocês pagam
        </button>
      ) : null}
    </section>
  );
}
