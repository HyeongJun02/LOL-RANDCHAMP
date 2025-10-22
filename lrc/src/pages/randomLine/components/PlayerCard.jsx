import React, { useEffect, useState } from 'react';
import { LINE_NAMES } from './lines';
import LineSelector from './LineSelector';
import Roulette from './Roulette';
import styles from './PlayerCard.module.css';

const PlayerCard = ({
  index,
  name,
  disabledLines,
  assignedLine,
  spinTrigger,
  onNameChange,
  onToggleLine,
  onAssign,
}) => {
  const [displayName, setDisplayName] = useState(name || `Player ${index + 1}`);

  useEffect(() => {
    setDisplayName(name || `Player ${index + 1}`);
  }, [name, index]);

  return (
    <div className={styles.card}>
      <input
        className={styles.nameInput}
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          onNameChange(index, e.target.value);
        }}
      />

      <LineSelector
        disabledLines={disabledLines}
        onToggle={(line) => onToggleLine(index, line)}
      />

      <button className={styles.assignButton} onClick={() => onAssign(index)}>
        ▶
      </button>

      <Roulette
        options={LINE_NAMES.filter((l) => !disabledLines.includes(l))}
        selectedOption={assignedLine}
        trigger={spinTrigger}
      />

      {/* {assignedLine && (
        <div className={styles.result}>
          {displayName} → {assignedLine}
        </div>
      )} */}
    </div>
  );
};

export default PlayerCard;
