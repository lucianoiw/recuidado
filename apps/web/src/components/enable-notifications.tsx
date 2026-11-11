"use client";

import { useEffect, useState } from "react";
import { BellIcon, buttonClass } from "@/components/ui";
import { currentPushState, enablePush, sendTestPush, type PushState } from "@/lib/push";

const MESSAGES: Record<PushState, string> = {
  unsupported:
    "Este navegador não recebe notificações. No iPhone, adicione o Recuidado à Tela de Início e abra por lá.",
  denied: "As notificações estão bloqueadas. Libere nas configurações do navegador.",
  off: "",
  on: "Notificações ativadas neste aparelho.",
};

export function EnableNotifications({
  memberId,
  label,
  large = false,
}: {
  memberId: string;
  label: string;
  large?: boolean;
}) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentPushState().then(setState, () => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const next = await enablePush(memberId);
      setState(next);
      if (next === "on") await sendTestPush(memberId);
    } catch {
      setError("Não deu para ativar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return null;

  return (
    <div className="flex flex-col gap-2">
      {state === "off" || state === "on" ? (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className={buttonClass({ variant: "secondary", size: large ? "lg" : "md" })}
        >
          <BellIcon size={large ? 28 : 22} />
          {busy ? "Ativando..." : state === "on" ? "Testar notificação" : label}
        </button>
      ) : null}
      {MESSAGES[state] ? <p className={large ? "text-[20px] text-muted" : "text-[15px] text-muted"}>{MESSAGES[state]}</p> : null}
      {error ? <p className="text-[15px] font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
