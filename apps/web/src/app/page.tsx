import { Author } from "@/components/sections/author";
import { Closing } from "@/components/sections/closing";
import { FamilyView } from "@/components/sections/family-view";
import { Faq } from "@/components/sections/faq";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { HowSheIs } from "@/components/sections/how-she-is";
import { Inside } from "@/components/sections/inside";
import { Numbers } from "@/components/sections/numbers";
import { PatientApp } from "@/components/sections/patient-app";
import { Pricing } from "@/components/sections/pricing";
import { Siblings } from "@/components/sections/siblings";
import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { SundayCall } from "@/components/sections/sunday-call";
import { Timeline } from "@/components/sections/timeline";

// Product site, approved design (canvas "Site completo", 12/11/2026). Text in content/site.tsx.
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Timeline />
        <HowSheIs />
        <SundayCall />
        <FamilyView />
        <Features />
        <Siblings />
        <PatientApp />
        <Numbers />
        <Pricing />
        <Faq />
        <Closing />
        <Inside />
        <Author />
      </main>
      <SiteFooter />
    </>
  );
}
