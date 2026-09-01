import React from 'react';
import { LINES } from '../../lines';
import styles from './LineSelector.module.css';

const LineSelector = ({ disabledLines, onToggle, compact = false }) => (
  <div className={`${styles.selector} ${compact ? styles.compact : ''}`}>
    {LINES.map((line) => {
      const banned = disabledLines.includes(line.name);
      return (
        <button
          type="button"
          key={line.name}
          className={`${styles.option} ${banned ? styles.banned : ''}`}
          onClick={() => onToggle(line.name)}
          title={banned ? `${line.name} 밴 해제` : `${line.name} 밴하기`}
          style={!banned ? { '--line-color': line.color, '--line-glow': line.glow } : undefined}
        >
          <img src={line.icon} alt={line.name} className={styles.icon} />
          {banned && <span className={styles.banMark}>✕</span>}
        </button>
      );
    })}
  </div>
);

export default LineSelector;
