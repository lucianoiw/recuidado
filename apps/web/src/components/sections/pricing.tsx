import { pricing } from "@/content/site";
import { links } from "@/lib/links";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import styles from "./pricing.module.css";

export function Pricing() {
  return (
    <Container as="section" id="preco" className={styles.section}>
      <Heading className={styles.title}>{pricing.title}</Heading>
      <div className={styles.plans}>
        <div className={`${styles.plan} ${styles.free}`}>
          <span className={styles.name}>{pricing.free.name}</span>
          <Text size="md">{pricing.free.text}</Text>
          <div className={styles.action}>
            <ButtonLink href={links.signUp} variant="outline">
              {pricing.free.action}
            </ButtonLink>
          </div>
        </div>
        <div className={`${styles.plan} ${styles.paid}`}>
          <span className={styles.head}>
            <span className={styles.name}>{pricing.paid.name}</span>
            <span className={styles.badge}>{pricing.paid.badge}</span>
          </span>
          <span className={styles.price}>
            {pricing.paid.price}
            <span className={styles.period}>{pricing.paid.period}</span>
          </span>
          <Text size="sm" className={styles.paidText}>
            {pricing.paid.text}
          </Text>
          <div className={styles.action}>
            <ButtonLink href={links.signUp} variant="light">
              {pricing.paid.action}
            </ButtonLink>
          </div>
        </div>
      </div>
    </Container>
  );
}
