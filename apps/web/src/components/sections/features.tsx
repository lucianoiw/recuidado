/* eslint-disable @next/next/no-img-element -- pill renders, already sized */
import { fairPrice, free, prescription } from "@/content/site";
import { photos } from "@/content/photos";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { PhoneIcon } from "@/components/ui/icons";
import { Photo } from "@/components/ui/photo";
import { Fine, Text } from "@/components/ui/text";
import styles from "./features.module.css";

// Prescription photo, what is free, and the fair price: three rows, image and text alternating.
export function Features() {
  return (
    <Container as="section" className={styles.section}>
      <div className={styles.row}>
        <div className={styles.copy}>
          <Heading className={styles.title11}>{prescription.title}</Heading>
          <Text>{prescription.text}</Text>
        </div>
        <div className={styles.visual}>
          <Photo name="maos" className={styles.photo} />
          <div className={styles.rxCard}>
            <span className={styles.cardLabel}>{prescription.card.label}</span>
            {prescription.card.items.map((item) => (
              <span key={item.name} className={styles.rxRow}>
                <span>{item.name}</span>
                <span className={styles.muted}>{item.times}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.pillBox}>
          <img src={photos.pilLilas.src} alt="" width={510} height={510} loading="lazy" className={styles.pillCenter} />
          <div className={styles.chips}>
            {free.chips.map((chip) => (
              <span key={chip.name} className={styles.chip}>
                {chip.name} · <b>{chip.program}</b>
              </span>
            ))}
          </div>
        </div>
        <div className={styles.copy}>
          <Heading className={styles.title12}>{free.title}</Heading>
          {free.paragraphs.map((p) => (
            <Text key={p}>{p}</Text>
          ))}
          <Fine>{free.fine}</Fine>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.copy}>
          <Heading className={styles.title12}>{fairPrice.title}</Heading>
          {fairPrice.paragraphs.map((p) => (
            <Text key={p}>{p}</Text>
          ))}
          <Fine>{fairPrice.fine}</Fine>
        </div>
        <div className={styles.pillBox}>
          <img src={photos.pilVerde.src} alt="" width={476} height={476} loading="lazy" className={styles.pillCorner} />
          <div className={styles.pharmCard}>
            <span className={styles.pharmLabel}>
              <PhoneIcon /> {fairPrice.card.label}
            </span>
            <span className={styles.pharmName}>{fairPrice.card.medicine}</span>
            {fairPrice.card.rows.map((row) => (
              <span key={row.label} className={styles.pharmRow}>
                <span>{row.label}</span>
                <b>{row.value}</b>
              </span>
            ))}
            <span className={styles.pharmNote}>{fairPrice.card.note}</span>
          </div>
        </div>
      </div>
    </Container>
  );
}
