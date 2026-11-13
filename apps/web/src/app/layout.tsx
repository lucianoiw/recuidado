import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

// Inter Tight served by next/font: preloaded in the HTML, with a metric-matched fallback. Latin subset covers pt-BR.
const interTight = localFont({
  src: "./fonts/inter-tight-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  // block: the font is small and preloaded, so the text waits a moment instead of swapping fonts.
  display: "block",
  variable: "--font-inter-tight",
  adjustFontFallback: "Arial",
});

const description =
  "O Recuidado acompanha os remédios da sua mãe, do seu pai ou dos seus avós. Lembrete no celular, ligação quando não há confirmação e aviso para a família.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.recuidado.com.br"),
  title: "Recuidado: chegou a sua vez de cuidar de quem sempre cuidou de você",
  description,
  openGraph: {
    title: "Recuidado",
    description,
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/fotos/abraco.jpg", width: 896, height: 1088 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#161314",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={interTight.variable}>
      <body>{children}</body>
    </html>
  );
}
