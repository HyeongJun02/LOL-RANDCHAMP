import React from 'react';
import { FaUndo } from 'react-icons/fa';
import { getGame, getRole, roleNamesOf } from '../../../games';
import LineSelector from '../../../components/common/LineSelector';
import RoleIcon from '../../../components/common/RoleIcon';
import RosterPicker from '../../../components/common/RosterPicker';
import styles from './PlayerRow.module.css';



/* 카드 뷰의 한 줄짜리 버전. 룰렛을 빼고 결과만 보여준다 */
const PlayerRow = ({
  game,
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
  const sample = getGame(game).sampleNames;
  const line = assignedLine ? getRole(game, assignedLine) : null;
  const noWayOut = roleNamesOf(game).every((l) => disabledLines.includes(l));

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
          placeholder={sample[index % sample.length]}
          onChange={(e) => onNameChange(index, e.target.value)}
        />
        <RosterPicker
          taken={takenNames}
          onPick={(m) => onPickMember(index, m)}
        />
      </div>

      <div className={styles.linesCell}>
        <LineSelector
          game={game}
          compact
          disabledLines={disabledLines}
          onToggle={(l) => onToggleLine(index, l)}
        />
      </div>

      <div className={styles.resultCell}>
        {line ? (
          <>
            <span className={styles.lineTag}>
              <RoleIcon role={line} />
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
