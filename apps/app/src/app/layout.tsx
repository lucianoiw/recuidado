import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { FrameBridge } from "@/components/frame-bridge";
import { ServiceWorker } from "@/components/service-worker";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/inter-tight";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recuidado",
  description: "O remédio de quem você ama, cuidado pela família toda.",
  appleWebApp: { capable: true, title: "Recuidado", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f8f4ef",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-bg font-sans text-ink">
        <ServiceWorker />
        <Suspense fallback={null}>
          <FrameBridge />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
