"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhoneIcon, buttonClass } from "@/components/ui";
import { captureError, track } from "@/lib/analytics";
import { getFamily, telHref, type FamilyOverview } from "@/lib/api";

/** One big button per family member with a phone. Her only choice here is whom to call. */
export function PatientCallView() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getFamily().then(setData, (e) => {
      captureError(e, { screen: "patient_call" });
      setError(true);
    });
  }, []);

  if (error) return <p className="text-[24px] text-muted">Sem conexão. Tente de novo em instantes.</p>;
  if (!data) return <p className="text-[24px] text-muted">Carregando...</p>;

  const callable = data.caregivers.filter((c) => telHref(c) !== null);

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-[22px] text-muted">Família</p>
        <h1 className="font-display text-[44px] leading-[1.02]">Para quem ligar?</h1>
      </header>
      {callable.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {callable.map((c) => (
            <li key={c.id}>
              <a
                href={telHref(c)!}
                onClick={() => track("patient_call_tapped", { caregivers: callable.length })}
                className={buttonClass({ size: "xl" })}
              >
                <PhoneIcon size={32} />
                Ligar para {c.name.trim().split(/\s+/)[0]}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[24px] leading-snug">Ninguém da família deixou o telefone ainda.</p>
      )}
      <Link href="/patient" className={buttonClass({ variant: "secondary", size: "lg", className: "mt-auto" })}>
        Voltar
      </Link>
    </>
  );
}
