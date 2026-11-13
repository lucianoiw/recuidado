import type { Metadata } from "next";
import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { ValidationPage } from "@/components/validation/validation-page";
import { validationPage } from "@/content/validation";

export const metadata: Metadata = {
  title: validationPage.metaTitle,
  description: validationPage.metaDescription,
  alternates: { canonical: "/validacao" },
};

// Full Tribunal de Ideias validation (canvas board Site-Validacao, approved 13/11/2026).
export default function Validacao() {
  return (
    <>
      <SiteHeader />
      <main>
        <ValidationPage />
      </main>
      <SiteFooter />
    </>
  );
}
