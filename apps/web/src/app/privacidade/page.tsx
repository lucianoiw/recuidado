import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Back } from "./back";

export const metadata: Metadata = {
  title: "Privacidade | Recuidado",
  description: "Quais dados o Recuidado guarda, para quê, com quem e por quanto tempo.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[20px] font-extrabold">{title}</h2>
      <div className="flex flex-col gap-2 leading-relaxed">{children}</div>
    </section>
  );
}

// LGPD (Lei 13.709/2018). Health data is sensitive (art. 5, II and art. 11).
// Keep in sync with the code: retention in VOICE_TRANSCRIPT_RETENTION_DAYS, telemetry in docs/monitoring.md.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pb-10 pt-6 text-[17px]">
      <Back />
      <header className="flex flex-col gap-2">
        <h1 className="text-[30px] font-extrabold leading-tight">Como cuidamos dos dados</h1>
        <p className="text-muted">
          Remédio é dado de saúde, e a lei trata dado de saúde como sensível. Por isso guardamos o mínimo e pedimos o
          aceite da pessoa cuidada.
        </p>
      </header>

      <Section title="O que guardamos">
        <ul className="ml-5 list-disc">
          <li>De quem cuida: nome, celular e parentesco.</li>
          <li>De quem é cuidada: nome, apelido, celular, data de nascimento e CEP.</li>
          <li>Os remédios, os horários e quantos comprimidos há em casa.</li>
          <li>Se cada dose foi tomada, e por onde foi confirmada (app ou ligação).</li>
          <li>Das ligações: o resultado, o que ela disse sobre como está e o texto da conversa.</li>
        </ul>
        <p>Não pedimos CPF, endereço completo nem diagnóstico. Não gravamos o áudio das ligações.</p>
      </Section>

      <Section title="Para quê">
        <p>
          Lembrar o remédio na hora, ligar quando a dose não é confirmada, avisar a família quando algo fica para
          trás e mostrar onde pegar o remédio de graça perto do CEP.
        </p>
        <p>
          O Recuidado não dá conselho médico e não muda dose nem tratamento. Em emergência, ligue para o SAMU 192.
        </p>
      </Section>

      <Section title="O aceite">
        <p>
          A base legal é o consentimento da pessoa cuidada (LGPD, art. 11, I). Quem faz o cadastro declara que
          conversou com ela, e ela confirma no primeiro acesso ao app dela. Sem aceite, não ligamos para ela.
        </p>
        <p>
          Ela pode dizer &ldquo;Não quero&rdquo; a qualquer momento: os avisos no celular dela são desligados e as
          ligações param.
        </p>
      </Section>

      <Section title="Quem mais processa">
        <ul className="ml-5 list-disc">
          <li>Anthropic (EUA) lê a foto da receita. A foto não fica guardada no Recuidado.</li>
          <li>OpenAI (EUA) faz a voz da assistente virtual durante a ligação.</li>
          <li>Nvoip (Brasil) completa a ligação telefônica.</li>
          <li>
            PostHog (EUA) recebe métricas de uso e erros. Não enviamos nomes de remédios nem o texto das ligações, e
            as gravações de tela escondem todo o texto.
          </li>
        </ul>
        <p>Isso é uma transferência internacional de dados (LGPD, art. 33), feita para o serviço funcionar.</p>
      </Section>

      <Section title="Por quanto tempo">
        <p>
          O texto das ligações e o que ela disse sobre como está são apagados depois de 90 dias. Fica só se tomou ou
          não. O resto fica enquanto a família usa o Recuidado.
        </p>
      </Section>

      <Section title="Seus direitos">
        <p>
          Em <b>Família, Seus dados</b>, quem fez o cadastro baixa tudo o que guardamos ou apaga a família inteira. Apagar
          é na hora e não tem volta.
        </p>
        <p>
          Dúvidas, pedidos sobre os seus dados ou para falar com o encarregado de dados:{" "}
          <a href="mailto:privacidade@recuidado.com.br" className="font-bold text-brand underline">
            privacidade@recuidado.com.br
          </a>
          .
        </p>
      </Section>

      <p className="text-[14px] text-muted">
        Projeto do Hack Brasil 2026. A família de demonstração usa só dados fictícios.
      </p>
    </main>
  );
}
