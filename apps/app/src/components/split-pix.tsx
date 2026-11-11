"use client";

import { useState } from "react";
import { Button, CheckIcon, CopyIcon, Field, Segmented, StatusPill, buttonClass } from "@/components/ui";
import { setPixKey, setSharePaid, type MonthShare, type MonthSummary, type PixKeyType } from "@/lib/api";
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

/** Split of this month's cost, with a Pix "copia e cola" for each share and who already paid. */
export function SplitPix({ month, isDemo, onChanged }: { month: MonthSummary; isDemo: boolean; onChanged: () => void }) {
  const [me] = useMe();
  const [changingKey, setChangingKey] = useState(false);
  const { receiver, shares } = month.split;
  const meIsCaregiver = shares.some((s) => s.memberId === me);
  const left = shares.filter((s) => !s.paid).reduce((sum, s) => sum + s.amountCents, 0);

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-extrabold">Dividir entre a família</h2>
        <span className="text-[18px] font-extrabold">{brl.format(month.costCents / 100)}</span>
      </div>
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

      {isDemo ? (
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
    </section>
  );
}
