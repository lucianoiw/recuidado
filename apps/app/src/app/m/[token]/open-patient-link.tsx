"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { Logo } from "@/components/ui";
import { setPatientLink } from "@/lib/session";

export function OpenPatientLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  useEffect(() => {
    if (/^[A-Za-z0-9_-]{16,64}$/.test(token)) setPatientLink(token);
    router.replace("/patient");
  }, [token, router]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Logo size={72} />
      <p className="text-[22px] font-bold">Abrindo...</p>
    </main>
  );
}
