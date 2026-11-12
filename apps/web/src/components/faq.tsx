const ITEMS: [string, string][] = [
  [
    "Precisa ter smartphone?",
    "Quem toma o remédio, não. Com smartphone, o lembrete aparece no celular e basta tocar em “Tomei”. Sem smartphone, o lembrete chega por ligação no telefone que a pessoa já usa, celular ou fixo. Já quem cuida precisa de um smartphone: é pelo app que a família cadastra a receita, acompanha o dia e recebe os avisos.",
  ],
  [
    "Quem fala na ligação?",
    "Uma assistente virtual com voz. Ela se apresenta assim logo na primeira frase, fala “a senhora” ou “o senhor”, diz o horário por extenso e não tem pressa.",
  ],
  [
    "E se a pessoa disser que não está bem?",
    "A família recebe o aviso com as palavras de quem atendeu. Se for queda, dor no peito ou falta de ar, o primeiro contato da família recebe uma ligação na hora. Se ele não atender, a assistente liga para o próximo da família, um de cada vez, até alguém ouvir o recado. Todos recebem o aviso no celular desde o começo. Depois, ela liga de volta para quem pediu ajuda.",
  ],
  [
    "O Recuidado muda o remédio ou a dose?",
    "Nunca. Ele segue a receita que a família conferiu. Mudança de remédio é com o médico.",
  ],
  [
    "Serve para pai, avó, avô ou tia?",
    "Sim. Serve para qualquer pessoa da família que toma remédio todo dia. No cadastro você escolhe se a assistente fala “a senhora” ou “o senhor”.",
  ],
  [
    "O que vocês guardam?",
    "O mínimo: sem CPF, sem endereço completo, sem diagnóstico e sem áudio. O texto das ligações é apagado em 90 dias. Quem fez o cadastro baixa ou apaga tudo quando quiser.",
  ],
];

// Native <details>: opens and closes without client JavaScript. The first answer starts open.
export function Faq() {
  return (
    <div style={{ borderBottom: "1px solid #e9e3dd" }}>
      {ITEMS.map(([question, answer], i) => (
        <details key={question} className="faq" open={i === 0} style={{ borderTop: "1px solid #e9e3dd" }}>
          <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", padding: "24px 0", cursor: "pointer" }}>
            <span className="faq-q" style={{ fontSize: "24px", color: "#161314" }}>{question}</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#161314" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
              <path d="M5 12h14"></path>
              <path className="faq-plus" d="M12 5v14"></path>
            </svg>
          </summary>
          <div style={{ padding: "0 0 26px" }}>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "40em", textWrap: "pretty" }}>{answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
