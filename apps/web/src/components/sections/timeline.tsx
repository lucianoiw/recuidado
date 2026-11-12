import { timeline } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import styles from "./timeline.module.css";

// A morning of Dona Maria, from the reminder to the call to a son.
export function Timeline() {
  return (
    <section id="como" className={styles.band}>
      <Container className={styles.inner}>
        <div className={styles.intro}>
          <Heading className={styles.title}>{timeline.title}</Heading>
          <Text className={styles.lead}>{timeline.text}</Text>
        </div>
        <ol className={styles.steps}>
          {timeline.steps.map((step, i) => (
            <li key={step.time} className={styles.step}>
              <span className={i === timeline.steps.length - 1 ? `${styles.dot} ${styles.last}` : styles.dot} aria-hidden="true" />
              <span className={styles.time}>{step.time}</span>
              <Text size="sm">{step.text}</Text>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
