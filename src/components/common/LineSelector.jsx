import React from 'react';
import { rolesOf } from '../../games';
import { DEFAULT_GAME } from '../../games';
import RoleIcon from './RoleIcon';
import styles from './LineSelector.module.css';

/* 못 가는 자리 고르기.

   롤은 라인(탑·정글…), 발로란트는 역할군(타격대·척후대…)이다. 이름도
   개수도 다르지만 하는 일은 같아서 한 컴포넌트로 둔다.
   롤 라인은 아이콘 파일이 있고, 발로 역할군은 이모지로 그린다. */
const LineSelector = ({ game = DEFAULT_GAME, disabledLines, onToggle, compact = false }) => (
  <div className={`${styles.selector} ${compact ? styles.compact : ''}`}>
    {rolesOf(game).map((line) => {
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
          <RoleIcon role={line} className={styles.icon} />
          {banned && <span className={styles.banMark}>✕</span>}
        </button>
      );
    })}
  </div>
);

export default LineSelector;
