/* eslint-disable @next/next/no-img-element -- static photos sized by the design */
import Link from "next/link";
import { Faq } from "@/components/faq";
import { Logo } from "@/components/logo";

// Product site, approved design (canvas "Site completo", 12/11/2026). Inline styles mirror the
// design file one to one; globals.css only adapts the layout to tablet and phone widths.
export default function Home() {
  return (
    <div style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", background: "#ffffff", color: "#161314", fontSize: "18px", lineHeight: "1.5", overflow: "hidden" }}>

      {/* Topo */}
      <div className="banner" style={{ background: "#161314", color: "#ffffff", padding: "12px 24px", textAlign: "center", fontSize: "15px", lineHeight: "1.45" }}><b style={{ fontWeight: "600" }}>Produto em validação.</b> O Recuidado participa de um programa de validação de produto e ainda não está à venda. Para proteger as famílias, os exemplos desta página usam pessoas e dados fictícios.</div>
      <header className="wrap" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", paddingTop: "26px", paddingBottom: "26px" }}>
        <Link href="/" aria-label="Recuidado" style={{ textDecoration: "none" }}><Logo /></Link>
        <nav className="nav" style={{ display: "flex", alignItems: "center", gap: "32px", fontSize: "16px" }}>
          <a href="#como" className="nav-link" style={{ textDecoration: "none", color: "#3d393b" }}>Como funciona</a>
          <a href="#preco" className="nav-link" style={{ textDecoration: "none", color: "#3d393b" }}>Preço</a>
          <a href="#perguntas" className="nav-link" style={{ textDecoration: "none", color: "#3d393b" }}>Perguntas</a>
          <a href="https://app.recuidado.com.br/entrar" style={{ textDecoration: "none", color: "#3d393b" }}>Entrar</a>
          <a href="https://app.recuidado.com.br/comecar" style={{ textDecoration: "none", background: "#161314", color: "#ffffff", padding: "12px 22px", borderRadius: "999px", fontWeight: "600" }} className="nav-cta">Começar o cadastro</a>
        </nav>
      </header>

      {/* 1. Primeira dobra */}
      <section className="wrap g-stack" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)", gap: "56px", alignItems: "center", paddingTop: "36px", paddingBottom: "96px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <h1 className="t-h1" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "72px", lineHeight: "1.02", letterSpacing: "-0.04em", color: "#161314", textWrap: "balance" }}>Chegou a sua vez de cuidar de quem sempre cuidou de você.</h1>
          <p style={{ margin: "0", fontSize: "20px", lineHeight: "1.55", color: "#3d393b", maxWidth: "29em", textWrap: "pretty" }}>O Recuidado acompanha os remédios da sua mãe, do seu pai ou dos seus avós. Na hora certa, o celular avisa. Se não houver confirmação, a gente liga, pergunta como a pessoa está e se já tomou. Se algo não vai bem, você e seus irmãos ficam sabendo na hora.</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}><a href="https://app.recuidado.com.br/comecar" style={{ textDecoration: "none", background: "#161314", color: "#ffffff", fontWeight: "600", fontSize: "18px", padding: "17px 30px", borderRadius: "999px", display: "inline-block" }}>Começar o cadastro</a><a href="#como" style={{ textDecoration: "none", color: "#161314", border: "1px solid #d9d2cc", fontWeight: "600", fontSize: "18px", padding: "16px 28px", borderRadius: "999px", display: "inline-block" }}>Ver como funciona</a></div>
          <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.5", color: "#6b6668", maxWidth: "40em" }}>Ninguém precisa saber mexer em aplicativo. A ligação chega em qualquer telefone.</p>
        </div>
        <div style={{ position: "relative" }}>
          <img fetchPriority="high" src="/fotos/abraco.jpg" alt="" className="ph" style={{ display: "block", width: "100%", height: "680px", objectFit: "cover", objectPosition: "50% 30%", borderRadius: "32px" }} />
          <div className="note-l" style={{ width: "290px", background: "#ffffff", borderRadius: "20px", padding: "14px 16px", boxShadow: "0 24px 48px -24px rgba(22, 19, 20, 0.45)", display: "flex", gap: "12px", alignItems: "flex-start", boxSizing: "border-box", position: "absolute", left: "-48px", bottom: "120px" }}><span style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#fcebf1", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fe398a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span><span style={{ display: "flex", flexDirection: "column", gap: "2px", lineHeight: "1.35" }}><span style={{ fontSize: "13px", color: "#6b6668" }}>Agora · Recuidado</span><span style={{ fontSize: "15px", color: "#161314" }}><b>Dona Maria tomou a Losartana</b> das 8h.</span></span></div>
          <div className="note-r" style={{ width: "270px", background: "#ffffff", borderRadius: "20px", padding: "14px 16px", boxShadow: "0 24px 48px -24px rgba(22, 19, 20, 0.45)", display: "flex", gap: "12px", alignItems: "flex-start", boxSizing: "border-box", position: "absolute", right: "28px", top: "32px" }}><span style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#fcebf1", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fe398a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></span><span style={{ display: "flex", flexDirection: "column", gap: "2px", lineHeight: "1.35" }}><span style={{ fontSize: "13px", color: "#6b6668" }}>Ligação das 8:15</span><span style={{ fontSize: "15px", color: "#161314" }}>“Bom dia! Já tomei, minha filha.”</span></span></div>
        </div>
      </section>

      {/* 2. Quando ela esquece */}
      <section id="como" className="pad-y" style={{ background: "#f8f4ef", padding: "112px 0" }}>
        <div className="wrap" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "64px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "54px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "22em", textWrap: "balance" }}>O que acontece quando a pessoa não confirma que tomou o remédio</h2>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "40em", textWrap: "pretty" }}>Na maioria das vezes, a história termina no “Tomei”. A ligação existe para os dias de esquecimento, e o aviso para os dias em que nem a ligação resolve. Veja como foi uma manhã da Dona Maria.</p>
          </div>
          <div className="g-time" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "36px" }}>
            <span className="time-line" style={{ position: "absolute", zIndex: "0", left: "0", right: "0", top: "6px", height: "1px", background: "#d8cfc7" }}></span>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ position: "relative", zIndex: "1", width: "13px", height: "13px", borderRadius: "50%", background: "#161314", boxShadow: "0 0 0 5px #f8f4ef" }}></span>
              <span className="time-h" style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "46px", lineHeight: "1", color: "#161314", marginTop: "6px" }}>8h00</span>
              <p style={{ margin: "0", fontSize: "17px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>O celular da Dona Maria mostra o remédio que ela precisa tomar naquela hora, com letra grande e um botão só: “Tomei”.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ position: "relative", zIndex: "1", width: "13px", height: "13px", borderRadius: "50%", background: "#161314", boxShadow: "0 0 0 5px #f8f4ef" }}></span>
              <span className="time-h" style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "46px", lineHeight: "1", color: "#161314", marginTop: "6px" }}>8h15</span>
              <p style={{ margin: "0", fontSize: "17px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Ela não tocou no botão. O Recuidado liga para ela, no celular ou no telefone fixo, sem precisar de internet. “Oi, Dona Maria, bom dia! Como a senhora está?” Depois pergunta se ela já tomou a Losartana das oito da manhã.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ position: "relative", zIndex: "1", width: "13px", height: "13px", borderRadius: "50%", background: "#161314", boxShadow: "0 0 0 5px #f8f4ef" }}></span>
              <span className="time-h" style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "46px", lineHeight: "1", color: "#161314", marginTop: "6px" }}>8h16</span>
              <p style={{ margin: "0", fontSize: "17px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Ela diz que ainda não tomou. A assistente pede, com calma, que ela tome agora, e avisa que vai ligar de novo em 15 minutos para confirmar.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ position: "relative", zIndex: "1", width: "13px", height: "13px", borderRadius: "50%", background: "#fe398a", boxShadow: "0 0 0 5px #f8f4ef" }}></span>
              <span className="time-h" style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "46px", lineHeight: "1", color: "#161314", marginTop: "6px" }}>8h31</span>
              <p style={{ margin: "0", fontSize: "17px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Se mesmo assim ela não tomou, ou não atendeu, a assistente liga para um dos filhos, com calma e sem alarde: “Olá, Carlos, tudo bem? Aqui é da Recuidado. Tentei falar com a Dona Maria e não consegui contato. Por favor, tente entrar em contato com ela. Obrigado.” Se o Carlos não atende, ela liga para o próximo filho. Todos os irmãos também recebem o aviso no celular e no e-mail.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Como ela está */}
      <section className="wrap g-stack pad-t pad-b" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1fr)", gap: "72px", alignItems: "center", paddingTop: "128px", paddingBottom: "128px" }}>
        <img loading="lazy" src="/fotos/fixo.jpg" alt="" className="ph" style={{ display: "block", width: "100%", height: "640px", objectFit: "cover", objectPosition: "40% 30%", borderRadius: "28px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "54px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "12em", textWrap: "balance" }}>Toda ligação começa perguntando como a pessoa está</h2>
          <blockquote style={{ margin: "0", padding: "0 0 0 22px", borderLeft: "3px solid #fe398a", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "28px", lineHeight: "1.25", color: "#161314" }}>“Oi, Dona Maria, bom dia! Como a senhora está?”</blockquote>
          <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Antes de falar do remédio, a assistente pergunta como ela está. Se ela disser que está cansada, com tontura ou com qualquer outra queixa, a família recebe um aviso com as palavras dela, do jeito que ela falou.</p>
          <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Se ela disser que caiu, que está com dor no peito ou com falta de ar, a assistente não fala mais de remédio. Ela avisa que vai chamar a família, desliga para deixar a linha livre e liga para o filho escolhido como primeiro contato, contando o que ela disse. Se ele não atender, liga para o próximo da família, um de cada vez, até alguém ouvir o recado. Todos recebem o aviso no celular desde o começo. Dez minutos depois, liga de volta para ela para saber se alguém já chegou.</p>
          <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.5", color: "#6b6668", maxWidth: "40em" }}>Não somos médicos e não damos nenhum conselho de saúde. Não mudamos dose nem tratamento. A gente só faz a ligação, escuta como ela está e avisa a família. Em emergência, pedimos para ligar para o SAMU, 192.</p>
        </div>
      </section>

      {/* 4. A ligação de domingo é sua */}
      <section className="wrap pad-b" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingBottom: "128px" }}>
        <div style={{ position: "relative", borderRadius: "36px", overflow: "hidden" }}>
          <img loading="lazy" src="/fotos/almoco.jpg" alt="" className="ph-ov" style={{ display: "block", width: "100%", height: "640px", objectFit: "cover", objectPosition: "center 35%", borderRadius: "0px" }} />
          <div className="ov-dark" style={{ position: "absolute", inset: "0", background: "linear-gradient(90deg, rgba(22, 19, 20, 0.78) 0%, rgba(22, 19, 20, 0.45) 45%, rgba(22, 19, 20, 0) 75%)" }}></div>
          <div className="ov-text ov-bottom" style={{ position: "absolute", left: "64px", bottom: "64px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "520px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "52px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#ffffff", maxWidth: "11em", textWrap: "balance" }}>A ligação do Recuidado não substitui a sua</h2>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#f3eeea", maxWidth: "32em", textWrap: "pretty" }}>A assistente liga para falar do remédio daquela hora e saber se ela está bem. A conversa sobre o neto, a novela e o almoço de domingo continua sendo sua. No app dela há um botão grande para ela ligar para você quando quiser.</p>
            <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.55", color: "#cfc7c1", maxWidth: "32em", textWrap: "pretty" }}>A assistente sempre se apresenta como assistente virtual na primeira frase. Quem atende sabe com quem está falando.</p>
          </div>
        </div>
      </section>

      {/* 5. O que você vê do seu celular */}
      <section className="pad-y" style={{ background: "#fcebf1", padding: "120px 0" }}>
        <div className="wrap g-stack" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 0.8fr)", gap: "56px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "50px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "11em", textWrap: "balance" }}>Você acompanha o dia de quem você cuida sem precisar perguntar</h2>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Na tela Hoje, cada remédio aparece com a hora certa e o que aconteceu: se foi tomado na hora, se precisou da ligação ou se ficou sem confirmar. Todo aviso fica guardado, então o irmão que entrou depois também vê o que aconteceu.</p>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>No fim do mês, um calendário mostra os dias em que ela tomou tudo, os dias em que precisou da ligação e os que ficaram sem confirmar. Dá para levar esse resumo em PDF para a consulta. Quando a caixa está acabando, a família recebe o aviso antes de faltar.</p>
          </div>
          <div className="phone" style={{ position: "relative" }}><div style={{ width: "290px", height: "603px", background: "#2b2c30", borderRadius: "41px", padding: "3px", boxSizing: "border-box", boxShadow: "0 40px 70px -40px rgba(22, 19, 20, 0.55)", flex: "none" }}>
          <div style={{ height: "100%", background: "#0c0c0e", borderRadius: "38px", padding: "7px", boxSizing: "border-box" }}>
            <div style={{ height: "100%", borderRadius: "32px", overflow: "hidden", background: "#ffffff", position: "relative", display: "flex", flexDirection: "column" }}>
              <div style={{ height: "28px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", fontSize: "11px", fontWeight: "500", color: "#161314", position: "relative", flex: "none" }}><span>8:00</span><span style={{ position: "absolute", left: "50%", top: "8px", marginLeft: "-5px", width: "10px", height: "10px", borderRadius: "50%", background: "#0c0c0e" }}></span><span style={{ display: "inline-flex", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#161314", clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}></span><span style={{ width: "7px", height: "11px", borderRadius: "2px", background: "#161314" }}></span></span></div>
              <div style={{ flex: "1", padding: "16px 16px 26px", display: "flex", flexDirection: "column", gap: "4px", background: "linear-gradient(180deg, #fcebf1 0%, #ffffff 38%)" }}>
                <span style={{ fontSize: "12px", color: "#6b6668" }}>Olá, Ana</span>
                <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "24px", lineHeight: "1.05", color: "#161314", marginBottom: "8px" }}>Hoje, quarta</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "1px solid #f0ebe6" }}><span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#161314", border: "1.5px solid #161314", boxSizing: "border-box", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span><span style={{ flex: "1", fontSize: "13px", color: "#161314" }}>Losartana 50 mg</span><span style={{ fontSize: "11px", color: "#6b6668" }}>Tomou às 8:02</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "1px solid #f0ebe6" }}><span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#161314", border: "1.5px solid #161314", boxSizing: "border-box", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span><span style={{ flex: "1", fontSize: "13px", color: "#161314" }}>Metformina 850 mg</span><span style={{ fontSize: "11px", color: "#6b6668" }}>Tomou às 8:17</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "1px solid #f0ebe6" }}><span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#ffffff", border: "1.5px solid #161314", boxSizing: "border-box", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}></span><span style={{ flex: "1", fontSize: "13px", color: "#161314" }}>Losartana 50 mg</span><span style={{ fontSize: "11px", color: "#6b6668" }}>Às 20:00</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "1px solid #f0ebe6" }}><span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#ffffff", border: "1.5px solid #161314", boxSizing: "border-box", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}></span><span style={{ flex: "1", fontSize: "13px", color: "#161314" }}>Rosuvastatina 10 mg</span><span style={{ fontSize: "11px", color: "#6b6668" }}>Às 20:00</span></div>
                <div style={{ marginTop: "12px", background: "#f8f4ef", borderRadius: "16px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "#6b6668" }}>Ligação das 8:15</span>
                  <span style={{ fontSize: "13px", lineHeight: "1.35", color: "#161314" }}>“Estou bem, só um pouco cansada hoje.”</span>
                </div>
                <div style={{ marginTop: "8px", background: "#161314", color: "#ffffff", borderRadius: "16px", padding: "12px", fontSize: "12px", lineHeight: "1.35" }}>A caixa de Rosuvastatina acaba em 4 dias.</div>
              </div>
              <span style={{ position: "absolute", left: "50%", bottom: "7px", marginLeft: "-40px", width: "80px", height: "4px", borderRadius: "2px", background: "#161314", opacity: "0.75" }}></span>
            </div>
          </div>
        </div></div>
          <img loading="lazy" src="/fotos/filha.jpg" alt="" className="ph" style={{ display: "block", width: "100%", height: "600px", objectFit: "cover", objectPosition: "45% 30%", borderRadius: "28px" }} />
        </div>
      </section>

      {/* 6, 7, 8. Receita, grátis, comprar */}
      <section className="wrap pad-t gap-big" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingTop: "128px", paddingBottom: "40px", display: "flex", flexDirection: "column", gap: "112px" }}>
        <div className="g-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "72px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "50px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "11em", textWrap: "balance" }}>Uma foto da receita médica e o plano está pronto</h2>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Você fotografa a receita do médico, mesmo escrita à mão, e a IA lê cada remédio, a dose e os horários. Você confere antes de salvar. A partir daí, os lembretes e as ligações seguem a receita.</p>
          </div>
          <div style={{ position: "relative" }}>
            <img loading="lazy" src="/fotos/maos.jpg" alt="" className="ph" style={{ display: "block", width: "100%", height: "460px", objectFit: "cover", objectPosition: "center 60%", borderRadius: "28px" }} />
            <div className="card-rx" style={{ position: "absolute", right: "24px", bottom: "-36px", width: "300px", background: "#ffffff", borderRadius: "20px", padding: "16px 18px", boxShadow: "0 24px 48px -24px rgba(22, 19, 20, 0.45)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#6b6668" }}>Lido da receita · confira</span>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}><span>Losartana 50 mg</span><span style={{ color: "#6b6668" }}>8h e 20h</span></span>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}><span>Metformina 850 mg</span><span style={{ color: "#6b6668" }}>8h e 20h</span></span>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}><span>Rosuvastatina 10 mg</span><span style={{ color: "#6b6668" }}>20h</span></span>
            </div>
          </div>
        </div>

        <div className="g-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "72px", alignItems: "center" }}>
          <div className="pill-box" style={{ background: "#f8f4ef", borderRadius: "32px", height: "440px", position: "relative", overflow: "hidden" }}>
            <img loading="lazy" src="/fotos/pil-lilas.jpg" alt="" className="pill" style={{ position: "absolute", left: "50%", top: "50%", width: "510px", height: "510px", margin: "-275px 0 0 -255px", objectFit: "cover", mixBlendMode: "multiply" }} />
            <div style={{ position: "absolute", left: "28px", bottom: "28px", right: "28px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ background: "#ffffff", borderRadius: "999px", padding: "9px 16px", fontSize: "15px" }}>Losartana · <b>grátis no Farmácia Popular</b></span>
              <span style={{ background: "#ffffff", borderRadius: "999px", padding: "9px 16px", fontSize: "15px" }}>Metformina · <b>grátis</b></span>
              <span style={{ background: "#ffffff", borderRadius: "999px", padding: "9px 16px", fontSize: "15px" }}>Sacubitril valsartana · <b>Alto Custo</b></span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "50px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "12em", textWrap: "balance" }}>Antes de comprar, a gente mostra o que dá para pegar de graça</h2>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Cada remédio da receita é comparado com a lista do Farmácia Popular, com os remédios entregues nos postos de saúde e com o programa de Alto Custo do estado. O mapa mostra as farmácias credenciadas e os postos mais perto da casa dela.</p>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Quando o remédio é de Alto Custo, o app mostra o passo a passo: quais papéis levar, quando o laudo vence e quando renovar.</p>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.5", color: "#6b6668", maxWidth: "40em" }}>Hoje, farmácias e postos de saúde são da cidade de São Paulo.</p>
          </div>
        </div>

        <div className="g-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "72px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "50px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "12em", textWrap: "balance" }}>O que não é de graça, a gente ajuda a pagar o preço justo</h2>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Para cada remédio que a família compra, o app mostra o preço máximo que a farmácia pode cobrar, pela tabela oficial do governo (CMED).</p>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>E a assistente liga para as farmácias mais perto da casa da pessoa. Ela passa pelo menu de teclas, pergunta se tem o genérico e quanto custa a caixa do genérico e a do remédio de referência. A resposta aparece no app, com o mais barato comparado ao preço máximo.</p>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.5", color: "#6b6668", maxWidth: "40em" }}>Durante a validação, as ligações vão para farmácias fictícias, para não incomodar farmácias de verdade.</p>
          </div>
          <div className="pill-box" style={{ background: "#f8f4ef", borderRadius: "32px", height: "440px", position: "relative", overflow: "hidden" }}>
            <img loading="lazy" src="/fotos/pil-verde.jpg" alt="" className="pill" style={{ position: "absolute", right: "-118px", top: "-108px", width: "476px", height: "476px", objectFit: "cover", mixBlendMode: "multiply" }} />
            <div className="card-pharm" style={{ position: "absolute", left: "32px", bottom: "32px", width: "340px", background: "#ffffff", borderRadius: "22px", padding: "18px 20px", boxShadow: "0 24px 48px -24px rgba(22, 19, 20, 0.4)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "13px", color: "#6b6668", display: "inline-flex", gap: "8px", alignItems: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fe398a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg> Ligação para a farmácia</span>
              <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "22px" }}>Rosuvastatina 10 mg</span>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", borderTop: "1px solid #f0ebe6", paddingTop: "10px" }}><span>Tem na loja</span><b>Sim</b></span>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}><span>Genérico</span><b>R$ 21,90</b></span>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}><span>Referência</span><b>R$ 48,50</b></span>
              <span style={{ fontSize: "13px", color: "#6b6668" }}>O genérico está abaixo do preço máximo.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Entre irmãos */}
      <section className="wrap pad-b" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingTop: "88px", paddingBottom: "128px" }}>
        <div className="g-stack box-dark" style={{ background: "#161314", borderRadius: "40px", padding: "72px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.9fr)", gap: "64px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "50px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#ffffff", maxWidth: "11em", textWrap: "balance" }}>Os irmãos combinam quem paga o remédio</h2>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#e7e1dc", maxWidth: "32em", textWrap: "pretty" }}>Cada família escolhe o seu jeito. No rodízio, cada mês um filho compra, na ordem que vocês definirem, e o app avisa de quem é a vez. Na divisão, um filho compra e o app mostra quanto cada irmão deve e a chave Pix de quem comprou.</p>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#e7e1dc", maxWidth: "32em", textWrap: "pretty" }}>Cada irmão faz o Pix pelo próprio banco, direto para quem comprou, e avisa no app tocando em “Já paguei”. O Recuidado não recebe nem confere pagamento. Se algum irmão não entra no rodízio, é só marcar no cadastro.</p>
          </div>
          <div style={{ background: "#ffffff", borderRadius: "28px", padding: "26px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "14px", color: "#6b6668" }}>Remédios de novembro</span>
            <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "26px", marginBottom: "10px" }}>Ana comprou. Dividido por 2.</span>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0", borderTop: "1px solid #f0ebe6" }}><span style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#fcebf1", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>A</span><span style={{ flex: "1" }}>Ana <span style={{ color: "#6b6668" }}>comprou</span></span><span style={{ fontSize: "14px", color: "#6b6668" }}>recebe a parte do irmão</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0", borderTop: "1px solid #f0ebe6" }}><span style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#f8f4ef", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>C</span><span style={{ flex: "1" }}>Carlos</span><span style={{ display: "inline-flex", gap: "8px" }}><span className="nowrap" style={{ fontSize: "14px", fontWeight: "600", border: "1px solid #e9e3dd", padding: "6px 12px", borderRadius: "999px" }}>Copiar Pix</span><span className="nowrap" style={{ fontSize: "14px", fontWeight: "600", background: "#fe398a", color: "#ffffff", padding: "6px 12px", borderRadius: "999px" }}>Já paguei</span></span></div>
            <div style={{ marginTop: "10px", background: "#f8f4ef", borderRadius: "16px", padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "15px" }}><span style={{ color: "#6b6668" }}>Rodízio</span><span>Dezembro é a vez do <b style={{ fontWeight: "600" }}>Carlos</b></span></div>
          </div>
        </div>
      </section>

      {/* 10. O app dela */}
      <section className="pad-y" style={{ background: "#f8f4ef", padding: "120px 0" }}>
        <div className="wrap g-stack" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) auto minmax(0, 1fr)", gap: "56px", alignItems: "center" }}>
          <img loading="lazy" src="/fotos/tomei.jpg" alt="" className="ph" style={{ display: "block", width: "100%", height: "600px", objectFit: "cover", objectPosition: "center 30%", borderRadius: "28px" }} />
          <div className="phone" style={{ position: "relative" }}><div style={{ width: "280px", height: "582px", background: "#e9e5dd", borderRadius: "39px", padding: "3px", boxSizing: "border-box", boxShadow: "0 40px 70px -40px rgba(22, 19, 20, 0.55)", flex: "none" }}>
          <div style={{ height: "100%", background: "#0c0c0e", borderRadius: "36px", padding: "7px", boxSizing: "border-box" }}>
            <div style={{ height: "100%", borderRadius: "31px", overflow: "hidden", background: "#ffffff", position: "relative", display: "flex", flexDirection: "column" }}>
              <div style={{ height: "28px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", fontSize: "11px", fontWeight: "500", color: "#161314", position: "relative", flex: "none" }}><span>8:00</span><span style={{ position: "absolute", left: "50%", top: "8px", marginLeft: "-5px", width: "10px", height: "10px", borderRadius: "50%", background: "#0c0c0e" }}></span><span style={{ display: "inline-flex", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#161314", clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}></span><span style={{ width: "7px", height: "11px", borderRadius: "2px", background: "#161314" }}></span></span></div>
              <div style={{ flex: "1", padding: "18px 16px 26px", display: "flex", flexDirection: "column", gap: "10px", background: "linear-gradient(180deg, #fcebf1 0%, #ffffff 45%)" }}>
                <span style={{ fontSize: "14px", color: "#6b6668" }}>Bom dia, Maria</span>
                <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "30px", lineHeight: "1.05", color: "#161314" }}>Hora do remédio</span>
                <div style={{ flex: "1", background: "#ffffff", borderRadius: "22px", boxShadow: "0 12px 28px -16px rgba(22, 19, 20, 0.35)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", padding: "10px" }}>
                  <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "22px", color: "#fe398a" }}>8:00</span>
                  <span style={{ width: "104px", height: "104px", margin: "10px 0 12px", borderRadius: "50%", background: "#fcebf1", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fe398a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></span>
                  <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "26px", color: "#161314" }}>Losartana</span>
                  <span style={{ fontSize: "14px", color: "#6b6668" }}>1 comprimido, com água</span>
                </div>
                <span style={{ background: "#161314", color: "#ffffff", borderRadius: "999px", padding: "16px 0", textAlign: "center", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "24px" }}>Tomei</span>
                <span style={{ border: "1px solid #e9e3dd", borderRadius: "999px", padding: "11px 0", textAlign: "center", fontSize: "15px", fontWeight: "600", color: "#161314" }}>Ligar para a família</span>
              </div>
              <span style={{ position: "absolute", left: "50%", bottom: "7px", marginLeft: "-40px", width: "80px", height: "4px", borderRadius: "2px", background: "#161314", opacity: "0.75" }}></span>
            </div>
          </div>
        </div></div>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "54px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "9em", textWrap: "balance" }}>Do outro lado, um botão só</h2>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>O app de quem toma o remédio mostra o nome do remédio da hora, quanto tomar e o botão “Tomei”. Letra grande, uma coisa por tela, nada para configurar. Quem cadastra tudo é a família.</p>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Ela também dá o próprio aceite no primeiro acesso. Sem o aceite dela, o Recuidado não liga.</p>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Se ela não usa celular com aplicativo, tudo bem: o lembrete chega por ligação.</p>
          </div>
        </div>
      </section>

      {/* 11. Números */}
      <section className="wrap pad-t pad-b" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingTop: "120px", paddingBottom: "120px", display: "flex", flexDirection: "column", gap: "48px" }}>
        <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "46px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "16em", textWrap: "balance" }}>Muita gente envelhece sem ninguém por perto na hora do remédio</h2>
        <div className="g-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: "1px solid #e9e3dd" }}>
          <div className="num" style={{ padding: "32px 32px 0 0", display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "88px", lineHeight: "1", color: "#fe398a" }}>40%</span><p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>de quem mora sozinho no Brasil tem 60 anos ou mais.</p><span style={{ fontSize: "13px", color: "#6b6668" }}>PNAD Contínua, IBGE, 2025</span></div>
          <div className="num" style={{ padding: "32px 32px 0", borderLeft: "1px solid #e9e3dd", display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "88px", lineHeight: "1", color: "#161314" }}>34,4%</span><p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>dos idosos brasileiros estão com a pressão alta quando ela é medida em casa.</p><span style={{ fontSize: "13px", color: "#6b6668" }}>ELSI-Brasil, Fiocruz, 2023-24</span></div>
          <div className="num" style={{ padding: "32px 0 0 32px", borderLeft: "1px solid #e9e3dd", display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "88px", lineHeight: "1", color: "#161314" }}>37,9%</span><p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>dos idosos com dificuldade nas tarefas do dia a dia recebem ajuda. Os outros se viram sozinhos.</p><span style={{ fontSize: "13px", color: "#6b6668" }}>ELSI-Brasil, Fiocruz, 2023-24</span></div>
        </div>
      </section>

      {/* 12. Preço */}
      <section id="preco" className="wrap pad-b" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingBottom: "128px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginBottom: "48px" }}>
          <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "54px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "14em", textWrap: "balance" }}>Quase tudo é de graça. As ligações são o plano pago.</h2>
        </div>
        <div className="g-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "20px" }}>
          <div className="box-price" style={{ border: "1px solid #e9e3dd", borderRadius: "32px", padding: "44px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "30px" }}>Grátis</span>
            <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Ler a receita, ver o que sai de graça, consultar o preço máximo, dividir a conta entre os irmãos e receber o lembrete no celular não custam nada.</p>
            <div style={{ marginTop: "auto" }}><a href="https://app.recuidado.com.br/comecar" style={{ textDecoration: "none", color: "#161314", border: "1px solid #d9d2cc", fontWeight: "600", fontSize: "18px", padding: "16px 28px", borderRadius: "999px", display: "inline-block" }}>Começar o cadastro</a></div>
          </div>
          <div className="box-price" style={{ background: "#161314", color: "#ffffff", borderRadius: "32px", padding: "44px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "30px" }} className="price-name">Recuidado Família</span><span className="nowrap" style={{ background: "#fe398a", borderRadius: "999px", padding: "5px 12px", fontSize: "14px", fontWeight: "600" }}>7 dias grátis</span></span>
            <span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "64px", lineHeight: "1" }} className="price">R$ 19,90<span className="nowrap" style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "18px", color: "#cfc7c1" }}> por mês</span></span>
            <p style={{ margin: "0", fontSize: "17px", lineHeight: "1.55", color: "#e7e1dc", maxWidth: "32em", textWrap: "pretty" }}>As ligações custam a cada minuto, então ficam neste plano: a ligação quando ela não confirma, a ligação para a família em emergência e de volta para ela, e a ligação para a farmácia. Cancelou, as ligações param e o resto continua.</p>
            <div style={{ marginTop: "auto" }}><a href="https://app.recuidado.com.br/comecar" style={{ textDecoration: "none", background: "#ffffff", color: "#161314", fontWeight: "600", fontSize: "18px", padding: "17px 30px", borderRadius: "999px", display: "inline-block" }}>Começar os 7 dias</a></div>
          </div>
        </div>
      </section>

      {/* 13. Perguntas */}
      <section id="perguntas" className="wrap g-stack pad-b" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingBottom: "128px", display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: "64px" }}>
        <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "54px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "14em", textWrap: "balance" }}>Perguntas</h2>
        <Faq />
      </section>

      {/* 14. Fechamento */}
      <section className="wrap" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingBottom: "72px" }}>
        <div style={{ position: "relative", borderRadius: "40px", overflow: "hidden" }}>
          <img loading="lazy" src="/fotos/filha-sorrindo.jpg" alt="" className="ph-ov" style={{ display: "block", width: "100%", height: "560px", objectFit: "cover", objectPosition: "60% 30%", borderRadius: "0px" }} />
          <div className="ov-light" style={{ position: "absolute", inset: "0", background: "linear-gradient(90deg, rgba(252, 235, 241, 0.97) 0%, rgba(252, 235, 241, 0.9) 38%, rgba(252, 235, 241, 0) 66%)" }}></div>
          <div className="ov-text ov-mid" style={{ position: "absolute", left: "64px", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "22px", maxWidth: "460px" }}>
            <h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "56px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "9em", textWrap: "balance" }}>Comece pelos remédios de quem você cuida</h2>
            <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.55", color: "#3d393b", maxWidth: "32em", textWrap: "pretty" }}>Tire uma foto da receita médica ou digite os remédios um por um. Depois, coloque o telefone de quem toma e chame os irmãos que vão acompanhar.</p>
            <div><a href="https://app.recuidado.com.br/comecar" style={{ textDecoration: "none", background: "#161314", color: "#ffffff", fontWeight: "600", fontSize: "18px", padding: "17px 30px", borderRadius: "999px", display: "inline-block" }}>Começar o cadastro</a></div>
          </div>
        </div>
      </section>

      {/* 15. Por dentro */}
      <section className="wrap" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingBottom: "72px" }}>
        <div className="g-four box-tech" style={{ background: "#f8f4ef", borderRadius: "40px", padding: "48px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
          <div style={{ padding: "6px 12px 6px 0", display: "flex", flexDirection: "column", gap: "12px" }}><h2 className="t-h2" style={{ margin: "0", fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontWeight: "400", fontSize: "36px", lineHeight: "1.04", letterSpacing: "-0.035em", color: "#161314", maxWidth: "8em", textWrap: "balance" }}>Por dentro do Recuidado</h2><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>A tecnologia que faz cada passo funcionar.</span></div>
          <div style={{ background: "#ffffff", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "20px", lineHeight: "1.2", color: "#161314" }}>Voz em tempo real</span><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>A ligação funciona em qualquer celular ou telefone fixo. A assistente responde em cerca de meio segundo, como em uma conversa.</span></div><div style={{ background: "#ffffff", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "20px", lineHeight: "1.2", color: "#161314" }}>Receita lida por IA</span><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>A foto da receita é lida pelo Claude, da Anthropic. A família confere cada remédio antes de salvar.</span></div><div style={{ background: "#ffffff", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "20px", lineHeight: "1.2", color: "#161314" }}>Dados oficiais</span><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>Preço máximo da tabela CMED, da Anvisa. Farmácias credenciadas e remédios grátis do Farmácia Popular, do Ministério da Saúde.</span></div><div style={{ background: "#ffffff", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "20px", lineHeight: "1.2", color: "#161314" }}>Tudo registrado</span><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>Cada ligação fica transcrita, com o que a assistente fez, para a família conferir depois.</span></div><div style={{ background: "#ffffff", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "20px", lineHeight: "1.2", color: "#161314" }}>Sem instalar nada</span><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>Por enquanto, o app abre no navegador do celular e avisa por notificação e por e-mail. Os apps para Android e iPhone vêm depois.</span></div><div style={{ background: "#ffffff", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "20px", lineHeight: "1.2", color: "#161314" }}>Conector para assistentes de IA</span><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>Quem usa o Claude ou o ChatGPT pode perguntar por lá: “meu pai tomou o remédio da pressão hoje?”.</span></div><div style={{ background: "#ffffff", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'Inter Tight Variable', 'Inter Tight', system-ui, sans-serif", fontSize: "20px", lineHeight: "1.2", color: "#161314" }}>Privacidade (LGPD)</span><span style={{ fontSize: "15px", lineHeight: "1.5", color: "#6b6668" }}>Quem toma o remédio dá o próprio aceite. A família exporta ou apaga os dados quando quiser. As transcrições são apagadas em 90 dias.</span></div>
        </div>
      </section>

      <footer className="wrap" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 64px", boxSizing: "border-box", paddingBottom: "56px" }}><div style={{ paddingTop: "32px", borderTop: "1px solid #e9e3dd", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
        <Logo width={140} />
        <span style={{ fontSize: "14px", color: "#6b6668", maxWidth: "46em" }}>Recuidado, produto em validação e ainda não comercializado. Os exemplos usam dados fictícios. A Dona Maria é uma personagem. <a href="https://app.recuidado.com.br/privacidade" style={{ color: "#6b6668" }}>Privacidade</a> · <a href="mailto:privacidade@recuidado.com.br" style={{ color: "#6b6668" }}>privacidade@recuidado.com.br</a></span>
      </div></footer>
    </div>
  );
}
