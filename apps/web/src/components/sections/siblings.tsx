import { siblings } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import styles from "./siblings.module.css";

// How siblings split or take turns paying, with a mock of the month card.
export function Siblings() {
  const c = siblings.card;
  return (
    <Container as="section" className={styles.section}>
      <div className={styles.box}>
        <div className={styles.copy}>
          <Heading className={styles.title}>{siblings.title}</Heading>
          {siblings.paragraphs.map((p) => (
            <Text key={p} className={styles.text}>
              {p}
            </Text>
          ))}
        </div>
        <div className={styles.card}>
          <span className={styles.label}>{c.label}</span>
          <span className={styles.cardTitle}>{c.title}</span>
          <div className={styles.person}>
            <span className={`${styles.avatar} ${styles.avatarBuyer}`}>{c.buyer.initial}</span>
            <span className={styles.name}>
              {c.buyer.name} <span className={styles.muted}>{c.buyer.action}</span>
            </span>
            <span className={styles.note}>{c.buyer.note}</span>
          </div>
          <div className={styles.person}>
            <span className={styles.avatar}>{c.payer.initial}</span>
            <span className={styles.name}>{c.payer.name}</span>
            <span className={styles.actions}>
              <span className={styles.pill}>{c.payer.copyPix}</span>
              <span className={`${styles.pill} ${styles.paid}`}>{c.payer.paid}</span>
            </span>
          </div>
          <div className={styles.rotation}>
            <span className={styles.muted}>{c.rotation.label}</span>
            <span>{c.rotation.text}</span>
          </div>
        </div>
      </div>
    </Container>
  );
}
