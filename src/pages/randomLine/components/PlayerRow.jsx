import React from 'react';
import { FaUndo } from 'react-icons/fa';
import { LINE_NAMES, getLine } from '../../../lines';
import LineSelector from '../../../components/common/LineSelector';
import RosterPicker from '../../../components/common/RosterPicker';
import styles from './PlayerRow.module.css';

const PLACEHOLDER_NAMES = ['탑차이', '정글탓', '관종미드', '버스원딜', '헌신서폿'];

/* 카드 뷰의 한 줄짜리 버전. 룰렛을 빼고 결과만 보여준다 */
const PlayerRow = ({
  index,
  name,
  takenNames,
  disabledLines,
  assignedLine,
  quote,
  onNameChange,
  onPickMember,
  onToggleLine,
  onAssign,
  onResetOne,
}) => {
  const line = assignedLine ? getLine(assignedLine) : null;
  const noWayOut = LINE_NAMES.every((l) => disabledLines.includes(l));

  return (
    <div
      className={styles.row}
      style={line ? { '--accent': line.color, '--accent-glow': line.glow } : undefined}
    >
      <span className={styles.badge}>P{index + 1}</span>

      <div className={styles.nameCell}>
        <input
          className={styles.nameInput}
          value={name}
          placeholder={PLACEHOLDER_NAMES[index % PLACEHOLDER_NAMES.length]}
          onChange={(e) => onNameChange(index, e.target.value)}
        />
        <RosterPicker
          taken={takenNames}
          onPick={(m) => onPickMember(index, m)}
        />
      </div>

      <div className={styles.linesCell}>
        <LineSelector
          compact
          disabledLines={disabledLines}
          onToggle={(l) => onToggleLine(index, l)}
        />
      </div>

      <div className={styles.resultCell}>
        {line ? (
          <>
            <span className={styles.lineTag}>
              <img src={line.icon} alt="" />
              {line.name}
            </span>
            <span className={styles.quote}>{quote}</span>
          </>
        ) : (
          <span className={styles.waiting}>대기 중</span>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.assign} ${line ? styles.assignDone : ''}`}
          onClick={() => onAssign(index)}
          disabled={noWayOut}
        >
          {noWayOut ? '갈 곳 없음' : line ? '다시' : '뽑기'}
        </button>
        {line && (
          <button
            className={styles.resetOne}
            onClick={() => onResetOne(index)}
            title="이 사람만 초기화"
            aria-label="이 사람만 초기화"
          >
            <FaUndo />
          </button>
        )}
      </div>
    </div>
  );
};

export default PlayerRow;
