"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhoneIcon, ScreenHeader, buttonClass } from "@/components/ui";
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
      <ScreenHeader audience="patient" eyebrow="Família" title="Para quem ligar?" />
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
