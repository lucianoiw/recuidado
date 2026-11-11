"use client";

import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui";

/** Goes back to where the notice was opened (sign-up, her app or the family tab). */
export function Back() {
  const router = useRouter();
  return (
    <TopBar
      onBack={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    />
  );
}
