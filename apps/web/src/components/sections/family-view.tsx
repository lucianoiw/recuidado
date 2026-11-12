import { familyView } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { CheckIcon } from "@/components/ui/icons";
import { PhoneFrame } from "@/components/ui/phone-frame";
import { Photo } from "@/components/ui/photo";
import { Text } from "@/components/ui/text";
import styles from "./family-view.module.css";

// The family's Today screen, drawn as a mock with the demo data.
function TodayScreen() {
  const s = familyView.screen;
  return (
    <div className={styles.screen}>
      <span className={styles.greeting}>{s.greeting}</span>
      <span className={styles.day}>{s.day}</span>
      {s.doses.map((dose, i) => (
        <div key={i} className={styles.dose}>
          <span className={dose.taken ? `${styles.check} ${styles.taken}` : styles.check}>
            {dose.taken && <CheckIcon size={12} color="#ffffff" strokeWidth={3.4} />}
          </span>
          <span className={styles.doseName}>{dose.name}</span>
          <span className={styles.doseStatus}>{dose.status}</span>
        </div>
      ))}
      <div className={styles.call}>
        <span className={styles.callLabel}>{s.call.label}</span>
        <span className={styles.callText}>{s.call.text}</span>
      </div>
      <div className={styles.stock}>{s.stock}</div>
    </div>
  );
}

export function FamilyView() {
  return (
    <section className={styles.band}>
      <Container className={styles.grid}>
        <div className={styles.copy}>
          <Heading className={styles.title}>{familyView.title}</Heading>
          {familyView.paragraphs.map((p) => (
            <Text key={p} size="md">
              {p}
            </Text>
          ))}
        </div>
        <PhoneFrame className={styles.phone}>
          <TodayScreen />
        </PhoneFrame>
        <Photo name="filha" className={styles.photo} />
      </Container>
    </section>
  );
}
