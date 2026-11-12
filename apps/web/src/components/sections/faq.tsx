import { faq } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import styles from "./faq.module.css";

// Native <details>: opens and closes without client JavaScript. The first answer starts open.
export function Faq() {
  return (
    <Container as="section" id="perguntas" className={styles.section}>
      <Heading>{faq.title}</Heading>
      <div className={styles.list}>
        {faq.items.map((item, i) => (
          <details key={item.question} className={styles.item} open={i === 0}>
            <summary className={styles.question}>
              <span>{item.question}</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#161314" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={styles.icon}>
                <path d="M5 12h14" />
                <path d="M12 5v14" className={styles.plus} />
              </svg>
            </summary>
            <div className={styles.answer}>
              <Text size="md" className={styles.answerText}>
                {item.answer}
              </Text>
            </div>
          </details>
        ))}
      </div>
    </Container>
  );
}
