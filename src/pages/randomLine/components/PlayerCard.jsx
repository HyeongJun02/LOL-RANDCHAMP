import React, { useEffect, useState } from 'react';
import { LINE_NAMES, getLine } from '../../../lines';
import LineSelector from '../../../components/common/LineSelector';
import RosterPicker from '../../../components/common/RosterPicker';
import Roulette from './Roulette';
import styles from './PlayerCard.module.css';

const PLACEHOLDER_NAMES = ['탑차이', '정글탓', '관종미드', '버스원딜', '헌신서폿'];

const PlayerCard = ({
  index,
  name,
  disabledLines,
  assignedLine,
  quote,
  spinTrigger,
  resetTrigger,
  takenNames,
  onNameChange,
  onPickMember,
  onToggleLine,
  onAssign,
}) => {
  const [displayName, setDisplayName] = useState(name);

  useEffect(() => {
    setDisplayName(name);
  }, [name]);

  const line = assignedLine ? getLine(assignedLine) : null;
  const remaining = LINE_NAMES.filter((l) => !disabledLines.includes(l)).length;
  const noWayOut = remaining === 0;

  return (
    <div
      className={styles.card}
      style={
        line
          ? {
              '--accent': line.color,
              '--accent-glow': line.glow,
            }
          : undefined
      }
    >
      <div className={styles.topBar} />

      <div className={styles.headRow}>
        <span className={styles.badge}>P{index + 1}</span>
        <span
          className={`${styles.status} ${line ? styles.statusLocked : ''}`}
          style={line ? { color: line.color, borderColor: line.color } : undefined}
        >
          {line ? line.name : '대기 중'}
        </span>
      </div>

      <div className={styles.nameRow}>
        <input
          className={styles.nameInput}
          value={displayName}
          placeholder={PLACEHOLDER_NAMES[index % PLACEHOLDER_NAMES.length]}
          onChange={(e) => {
            setDisplayName(e.target.value);
            onNameChange(index, e.target.value);
          }}
        />
        <RosterPicker
          taken={takenNames}
          onPick={(m) => {
            setDisplayName(m.name);
            onPickMember(index, m);
          }}
        />
      </div>

      <div className={styles.selectorLabel}>가기 싫은 라인 밴하기</div>
      <LineSelector
        disabledLines={disabledLines}
        onToggle={(l) => onToggleLine(index, l)}
      />

      <div className={styles.rouletteFrame}>
        <span className={`${styles.corner} ${styles.cornerTL}`} />
        <span className={`${styles.corner} ${styles.cornerTR}`} />
        <span className={`${styles.corner} ${styles.cornerBL}`} />
        <span className={`${styles.corner} ${styles.cornerBR}`} />
        <Roulette
          options={LINE_NAMES.filter((l) => !disabledLines.includes(l))}
          selectedOption={assignedLine}
          trigger={spinTrigger}
          resetTrigger={resetTrigger}
        />
      </div>

      <button
        className={`${styles.assignButton} ${line ? styles.assignDone : ''}`}
        onClick={() => onAssign(index)}
        disabled={noWayOut}
      >
        <span className={styles.dice}>🎲</span>
        {noWayOut ? '갈 곳 없음' : line ? '다시 뽑기' : '뽑기'}
      </button>

      <div className={styles.result} style={{ opacity: line ? 1 : 0 }}>
        {line && (
          <>
            <span className={styles.resultTag}>{line.name} 확정</span>
            <span className={styles.resultQuote}>{quote}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;
