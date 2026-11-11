import type { Metadata } from "next";
import { Panel } from "./panel";

export const metadata: Metadata = {
  title: "Recuidado ao vivo",
  description: "O celular do filho e o da mãe, lado a lado, com os dois apps de verdade.",
};

/** painel.recuidado.com.br: the two real apps side by side, for the pitch and the video. */
export default function PanelPage() {
  return <Panel />;
}
