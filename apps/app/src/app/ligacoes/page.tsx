import type { Metadata } from "next";
import { CallsView } from "./calls-view";

export const metadata: Metadata = {
  title: "Ligações | Recuidado",
  description: "As ligações da prova de conceito: o áudio, o que cada lado disse e o que o sistema fez em cada momento.",
};

/** The calls panel: recording, transcript and timeline of the demo family's calls. Public, synthetic data. */
export default function CallsPage() {
  return <CallsView />;
}
