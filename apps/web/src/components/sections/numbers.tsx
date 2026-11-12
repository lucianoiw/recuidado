import { numbers } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import styles from "./numbers.module.css";

export function Numbers() {
  return (
    <Container as="section" className={styles.section}>
      <Heading className={styles.title}>{numbers.title}</Heading>
      <div className={styles.grid}>
        {numbers.items.map((item) => (
          <div key={item.value} className={styles.item}>
            <span className={styles.value}>{item.value}</span>
            <Text size="md">{item.text}</Text>
            <span className={styles.source}>{item.source}</span>
          </div>
        ))}
      </div>
    </Container>
  );
}
