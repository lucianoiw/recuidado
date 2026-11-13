import { tribunalUrl, validationPage as v } from "@/content/validation";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { ScoreBoard } from "./score-board";
import styles from "./validation-page.module.css";

type Argument = { who: string; quote: string; text: string };

function Arguments({ label, items, dark }: { label: string; items: Argument[]; dark?: boolean }) {
  return (
    <div className={dark ? `${styles.args} ${styles.argsDark}` : styles.args}>
      <span className={styles.argsLabel}>{label}</span>
      <ul className={styles.argsList}>
        {items.map((item) => (
          <li key={item.who} className={styles.arg}>
            <span className={styles.argQuote}>“{item.quote}”</span>
            <span className={styles.argText}>{item.text}</span>
            <span className={styles.argWho}>{item.who}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHead({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.head}>
      <Heading className={styles.h2}>{title}</Heading>
      <Text className={styles.lead}>{text}</Text>
    </div>
  );
}

// Every block of the Tribunal de Ideias report, in the site's style. Text in content/validation.ts.
export function ValidationPage() {
  return (
    <>
      <Container as="section" className={styles.opening}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>{v.eyebrow}</span>
          <Heading level={1} className={styles.h1}>
            {v.title}
          </Heading>
          <Text className={styles.lead}>{v.text}</Text>
          <a href={tribunalUrl} className={styles.button}>
            {v.tribunalAction}
          </a>
        </div>
        <ScoreBoard />
      </Container>

      <section className={styles.blush}>
        <Container className={styles.opinion}>
          <span className={styles.eyebrow}>{v.opinion.eyebrow}</span>
          <blockquote className={styles.quote}>
            {v.opinion.paragraphs.map((text) => (
              <p key={text}>“{text}”</p>
            ))}
          </blockquote>
          <span className={styles.muted}>{v.opinion.author}</span>
        </Container>
      </section>

      <Container as="section" className={styles.block}>
        <SectionHead title={v.debate.title} text={v.debate.text} />
        <div className={styles.two}>
          <Arguments label={v.debate.critiques.label} items={v.debate.critiques.items} />
          <Arguments label={v.debate.answers.label} items={v.debate.answers.items} dark />
        </div>
      </Container>

      <section className={styles.cream}>
        <Container className={styles.block}>
          <SectionHead title={v.people.title} text={v.people.text} />
          <div className={styles.people}>
            {v.people.items.map((person) => (
              <div key={person.name} className={styles.person}>
                <span className={person.buys ? `${styles.tag} ${styles.tagYes}` : styles.tag}>{person.buys ? v.people.yes : v.people.no}</span>
                <span className={styles.personQuote}>“{person.quote}”</span>
                <span className={styles.personText}>{person.text}</span>
                <span className={styles.personName}>{person.name}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Container as="section" className={styles.block}>
        <SectionHead title={v.buyers.title} text={v.buyers.text} />
        <div className={styles.buyers}>
          <div className={styles.buyersSide}>
            <div className={styles.big}>
              <span className={styles.bigValue}>{v.buyers.big}</span>
              <span className={styles.bigText}>{v.buyers.bigText}</span>
            </div>
            <div className={styles.prices}>
              <h3 className={styles.h3}>{v.buyers.pricesTitle}</h3>
              {v.buyers.prices.map((price) => (
                <div key={price.group} className={styles.price}>
                  <span>{price.group}</span>
                  <b>{price.range}</b>
                </div>
              ))}
              <span className={styles.priceNote}>{v.buyers.pricesNote}</span>
            </div>
          </div>
          <div>
            <h3 className={styles.h3}>{v.buyers.objectionsTitle}</h3>
            <p className={styles.objectionsText}>{v.buyers.objectionsText}</p>
            <ul className={styles.objections}>
              {v.buyers.objections.map((item) => (
                <li key={item.label} className={styles.objection}>
                  <span className={styles.objectionCount}>
                    {item.count}
                    <span className={styles.objectionOf}>{v.buyers.of}</span>
                  </span>
                  <span className={styles.objectionLabel}>{item.label}</span>
                  <span className={styles.objectionQuote}>“{item.quote}”</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>

      <Container as="section" className={`${styles.block} ${styles.noTop}`}>
        <SectionHead title={v.math.title} text={v.math.text} />
        <div className={styles.math}>
          {v.math.items.map((item) => (
            <div key={item.value} className={styles.mathItem}>
              <span className={styles.mathValue}>{item.value}</span>
              <span className={styles.mathText}>{item.text}</span>
            </div>
          ))}
        </div>
      </Container>

      <section className={styles.cream}>
        <Container className={styles.block}>
          <SectionHead title={v.evaluators.title} text={v.evaluators.text} />
          <ul className={styles.evaluators}>
            {v.evaluators.items.map((item) => (
              <li key={item.model} className={styles.evaluator}>
                <div className={styles.evaluatorHead}>
                  <span className={styles.evaluatorScore}>{item.score}</span>
                  <span className={styles.evaluatorName}>
                    {item.model}
                    <span className={styles.muted}>{item.company}</span>
                  </span>
                </div>
                <span className={styles.evaluatorQuote}>“{item.quote}”</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container as="section" className={styles.block}>
        <SectionHead title={v.steps.title} text={v.steps.text} />
        <ol className={styles.steps}>
          {v.steps.items.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{String(i + 1).padStart(2, "0")}</span>
              <span className={styles.stepTitle}>{step.title}</span>
              <span className={styles.stepGoal}>
                <b>{v.steps.goal}</b> {step.goal}
              </span>
            </li>
          ))}
        </ol>
      </Container>

      <Container as="section" className={styles.aboutSection}>
        <div className={styles.about}>
          {v.about.items.map((item) => (
            <div key={item.value} className={styles.aboutItem}>
              <span className={styles.aboutValue}>{item.value}</span>
              <span className={styles.muted}>{item.text}</span>
            </div>
          ))}
          <p className={styles.aboutFine}>
            {v.about.fine} <a href={tribunalUrl}>{v.about.link}</a>.
          </p>
        </div>
      </Container>
    </>
  );
}
