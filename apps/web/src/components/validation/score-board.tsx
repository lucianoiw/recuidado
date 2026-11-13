import { validationScore as v } from "@/content/validation";
import styles from "./score-board.module.css";

const decimal = (value: number) => value.toFixed(1).replace(".", ",");

// 86/100 card next to the grades per criterion. Used in the home fold and on /validacao.
export function ScoreBoard() {
  return (
    <div className={styles.board}>
      <div className={styles.verdict}>
        <div className={styles.score}>
          <span className={styles.scoreValue}>{v.score}</span>
          <span className={styles.scoreMax}>{v.scoreMax}</span>
        </div>
        <span className={styles.badge}>{v.badge}</span>
        <p className={styles.summary}>{v.summary}</p>
        <dl className={styles.facts}>
          {v.facts.map((fact) => (
            <div key={fact.value}>
              <dt>{fact.value}</dt>
              <dd>{fact.text}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={styles.criteria}>
        <h3 className={styles.subtitle}>{v.criteriaTitle}</h3>
        <ul className={styles.bars}>
          {v.criteria.map((item, i) => (
            <li key={item.label} className={styles.bar}>
              <span className={styles.barLabel}>{item.label}</span>
              <span className={styles.barValue}>
                {decimal(item.value)}
                <span className={styles.barMax}> de 5</span>
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={i < 3 ? `${styles.fill} ${styles.top}` : styles.fill} style={{ width: `${(item.value / 5) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
