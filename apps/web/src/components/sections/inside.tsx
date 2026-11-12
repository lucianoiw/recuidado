import { inside } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import styles from "./inside.module.css";

// The technology behind each step, for the curious and for the judges.
export function Inside() {
  return (
    <Container as="section" className={styles.section}>
      <div className={styles.box}>
        <div className={styles.intro}>
          <Heading className={styles.title}>{inside.title}</Heading>
          <span className={styles.subtitle}>{inside.subtitle}</span>
        </div>
        {inside.items.map((item) => (
          <div key={item.title} className={styles.card}>
            <span className={styles.cardTitle}>{item.title}</span>
            <span className={styles.cardText}>{item.text}</span>
          </div>
        ))}
      </div>
    </Container>
  );
}
