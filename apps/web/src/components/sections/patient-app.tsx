import { patientApp } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { BellIcon } from "@/components/ui/icons";
import { PhoneFrame } from "@/components/ui/phone-frame";
import { Photo } from "@/components/ui/photo";
import { Text } from "@/components/ui/text";
import styles from "./patient-app.module.css";

// The app of who takes the medicine: one medicine, one button.
function MedicineScreen() {
  const s = patientApp.screen;
  return (
    <div className={styles.screen}>
      <span className={styles.greeting}>{s.greeting}</span>
      <span className={styles.screenTitle}>{s.title}</span>
      <div className={styles.dose}>
        <span className={styles.time}>{s.time}</span>
        <span className={styles.bell}>
          <BellIcon />
        </span>
        <span className={styles.medicine}>{s.medicine}</span>
        <span className={styles.amount}>{s.dose}</span>
      </div>
      <span className={styles.taken}>{s.taken}</span>
      <span className={styles.callFamily}>{s.callFamily}</span>
    </div>
  );
}

export function PatientApp() {
  return (
    <section className={styles.band}>
      <Container className={styles.grid}>
        <Photo name="tomei" className={styles.photo} />
        <PhoneFrame tone="light" className={styles.phone}>
          <MedicineScreen />
        </PhoneFrame>
        <div className={styles.copy}>
          <Heading className={styles.title}>{patientApp.title}</Heading>
          {patientApp.paragraphs.map((p) => (
            <Text key={p} size="md">
              {p}
            </Text>
          ))}
        </div>
      </Container>
    </section>
  );
}
