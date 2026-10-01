import React, { useEffect, useState } from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';

/* 총 킬 기준선을 고르는 칸. 내전 또또와 일반 게임 또또가 같이 쓴다.

   .5 단위로만 움직인다 - 딱 맞으면 무승부라 어느 쪽도 못 준다.
   손으로 60을 치면 60.5로 맞춰준다. */

const STEP = 1;
export const MIN_LINE = 5.5;
export const MAX_LINE = 300.5;

export const snapLine = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_LINE, Math.max(MIN_LINE, Math.floor(n) + 0.5));
};

/* value: 지금 기준선 / auto: 자동값 / autoLabel: 자동일 때 옆에 적을 말
   onChange(값): 버튼을 누르거나 칸에서 손을 뗄 때 */
const KillLinePicker = ({ value, auto, autoLabel, onChange }) => {
  /* 타이핑 중에는 '5'처럼 아직 말이 안 되는 값도 지나간다.
     화면에 보이는 글자는 따로 들고 있다가 손을 뗄 때 맞춘다 */
  const [draft, setDraft] = useState(String(value));

  /* 바깥에서 값이 바뀌면(모드를 바꿔 자동값이 달라졌을 때) 칸도 따라간다 */
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const bump = (d) => onChange(Math.min(MAX_LINE, Math.max(MIN_LINE, value + d)));
  const commit = () => onChange(snapLine(draft) ?? value);
  const custom = value !== auto;

  return (
    <div className="line-picker">
      <button className="ghost-btn" onClick={() => bump(-STEP)} aria-label="기준선 내리기">
        <FaMinus />
      </button>
      <span className="line-value">
        {/* 30 언저리에서 50으로 가려면 버튼을 스무 번 눌러야 한다. 칠 수도 있어야 한다 */}
        <input
          type="number"
          step="1"
          min={MIN_LINE}
          max={MAX_LINE}
          value={draft}
          aria-label="총 킬 기준선"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <em>{custom ? '직접 정함' : autoLabel}</em>
      </span>
      <button className="ghost-btn" onClick={() => bump(STEP)} aria-label="기준선 올리기">
        <FaPlus />
      </button>
      {custom && (
        <button className="ghost-btn line-reset" onClick={() => onChange(auto)}>
          자동으로
        </button>
      )}
    </div>
  );
};

export default KillLinePicker;
