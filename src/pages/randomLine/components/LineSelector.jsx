import React from 'react';
import { LINES } from './lines';
import styles from './LineSelector.module.css';

const LineSelector = ({ disabledLines, onToggle }) => (
  <div className={styles.selector}>
    {LINES.map((line) => {
      const banned = disabledLines.includes(line.name);
      return (
        <div
          key={line.name}
          className={`${styles.option} ${banned ? styles.banned : ''}`}
          onClick={() => onToggle(line.name)}
        >
          <img src={line.icon} alt={line.name} className={styles.icon} />
          {/* <span className={styles.label}>{line.name}</span> */}
        </div>
      );
    })}
  </div>
);

export default LineSelector;
