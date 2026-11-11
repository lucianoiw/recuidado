import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/service-worker";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recuidado",
  description: "Cuida do remédio do idoso junto com a família.",
};

export const viewport: Viewport = {
  themeColor: "#0b5d57",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-bg font-sans text-ink">
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
