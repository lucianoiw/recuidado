"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PatientLink, markPatientLinkSeen } from "@/components/patient-link";
import { PageTitle } from "@/components/page-title";
import { buttonClass } from "@/components/ui";
import { callName } from "@/lib/api";
import { useFamily } from "@/lib/use-family";
import { pronouns } from "@/lib/pronouns";

export function PhoneSetupView() {
  const { data } = useFamily();
  const pr = pronouns(data?.patient.gender);
  const name = data ? callName(data.patient) : pr.ela;
  const steps = [
    `Abra o link no celular ${pr.dela}.`,
    "O app mostra o resto em letras grandes: colocar na tela e permitir os avisos.",
  ];

  useEffect(() => {
    markPatientLinkSeen();
  }, []);

  return (
    <>
      <PageTitle
        title={`O celular de ${name}`}
        subtitle={`Leva 1 minuto. Faça junto com ${pr.ela} ou na próxima visita.`}
      />
      <PatientLink />
      <ol className="flex flex-col gap-3.5">
        {steps.map((t, i) => (
          <li key={t} className="flex items-start gap-3">
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-semibold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-snug">{t}</span>
          </li>
        ))}
      </ol>
      {/* Calls are the paid plan: the free plan does not mention them. */}
      {data?.calls === false ? null : (
        <p className="rounded-2xl bg-brand-soft p-3.5 text-[15px] leading-snug">
          {`${pr.Ela} não usa celular? Tudo bem: a gente liga no horário de cada remédio.`}
        </p>
      )}
      <div className="mt-auto pt-2">
        <Link href="/family" className={buttonClass()}>
          Pronto, ir para o painel
        </Link>
      </div>
    </>
  );
}
