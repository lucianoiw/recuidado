"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo, buttonClass } from "@/components/ui";
import { track } from "@/lib/analytics";
import { verifySignIn } from "@/lib/api";
import { afterSignIn } from "../after-sign-in";

export function SignInLink() {
  const router = useRouter();
  const params = useSearchParams();
  const missing = !params.get("t");
  const [failed, setFailed] = useState<string | null>(null);
  const error = missing ? "Link incompleto." : failed;
  const started = useRef(false);

  useEffect(() => {
    // The link works once: never verify it twice (React runs effects twice in development).
    if (started.current) return;
    started.current = true;
    const link = params.get("t");
    if (!link) return;
    verifySignIn({ link }).then(
      async (me) => {
        track("signed_in", { via: "link", newUser: !me.memberId });
        router.replace(await afterSignIn(me, params));
      },
      (e) => setFailed(e instanceof Error ? e.message : "Não deu para entrar."),
    );
  }, [params, router]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size={64} />
      {error ? (
        <>
          <p className="text-[19px] font-semibold">{error}</p>
          <Link href="/entrar" className={buttonClass()}>
            Pedir um código novo
          </Link>
        </>
      ) : (
        <p className="text-[19px] font-semibold">Entrando...</p>
      )}
    </main>
  );
}
