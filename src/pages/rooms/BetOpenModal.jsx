import React, { useState } from 'react';
import { FaDice, FaMinus, FaPlus } from 'react-icons/fa';
import Modal from '../../components/common/Modal';
import { killLineFor } from '../../server/rooms';
import { useGameKey } from '../../lib/GameContext';
import { CLOSE_PRESETS as PRESETS } from '../../rules/tuning';

/* 또또를 열기 전에 방장이 정하는 것들.

   배팅 시간: '직접 마감'이 기본이다. 시간을 정해두면 방장이 잊어도 알아서
   닫히지만, 경기 시작이 늦어지는 일이 잦아서 강제하지는 않는다.

   총 킬 기준선: 인원으로 자동 계산하지만, 그날 분위기(빡겜/즐겜)에 따라
   실제 킬 수가 꽤 달라진다. 열기 전에 손으로 올리고 내릴 수 있게 둔다.
   .5 단위로만 움직인다 - 딱 맞으면 무승부라 애매해진다. */

const STEP = 1;
const MIN_LINE = 5.5;
const MAX_LINE = 300.5;

/* 늘 .5로 끝나야 한다. 딱 맞으면 무승부라 어느 쪽도 못 준다.
   손으로 60을 치면 60.5로 맞춰준다 */
const snap = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_LINE, Math.max(MIN_LINE, Math.floor(n) + 0.5));
};

const BetOpenModal = ({ onClose, onOpen, playerCount, mode }) => {
  const game = useGameKey();
  const auto = killLineFor(playerCount, game, mode);
  const [seconds, setSeconds] = useState(null);
  const [line, setLine] = useState(auto);
  /* 타이핑 중에는 '5'처럼 아직 말이 안 되는 값도 지나간다.
     화면에 보이는 글자는 따로 들고 있다가 손을 뗄 때 맞춘다 */
  const [draft, setDraft] = useState(String(auto));
  const [busy, setBusy] = useState(false);

  const put = (v) => {
    setLine(v);
    setDraft(String(v));
  };

  const bump = (d) => put(Math.min(MAX_LINE, Math.max(MIN_LINE, line + d)));

  /* 손을 떼면 .5로 맞춘다. 아무 말도 안 되면 원래 값으로 되돌린다 */
  const commit = () => put(snap(draft) ?? line);

  const custom = line !== auto;

  const start = async () => {
    setBusy(true);
    try {
      /* 자동값 그대로면 굳이 박아두지 않는다. 비워두면 화면이 인원으로 계산한다 */
      /* 칸에 적어두고 바로 연 경우까지 챙긴다. onBlur가 안 돌았을 수 있다 */
      const final = snap(draft) ?? line;
      await onOpen(seconds, final !== auto ? final : null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="또또 열기"
      desc="배팅을 받기 시작합니다. 경기 결과는 나중에 넣습니다."
      size="modal-sm"
      onClose={onClose}
      footer={
        <button className="dialog-ok" onClick={start} disabled={busy}>
          <FaDice /> {busy ? '여는 중…' : '또또 열기'}
        </button>
      }
    >
      <p className="bet-open-label">배팅 시간</p>
      <div className="bet-open-presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`ghost-btn ${seconds === p.seconds ? 'is-on' : ''}`}
            onClick={() => setSeconds(p.seconds)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="rooms-hint">
        {seconds
          ? `${seconds / 60 >= 1 ? `${seconds / 60}분` : `${seconds}초`} 뒤 자동으로 마감됩니다. 그 전에 방장이 직접 마감해도 됩니다.`
          : '자동 마감 없이 열립니다. 또또 탭에서 방장이 직접 마감해야 합니다.'}
      </p>

      <p className="bet-open-label" style={{ marginTop: '1rem' }}>
        총 킬 기준선
      </p>
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
          <em>{custom ? '직접 정함' : `${playerCount}명 기준 자동`}</em>
        </span>
        <button className="ghost-btn" onClick={() => bump(STEP)} aria-label="기준선 올리기">
          <FaPlus />
        </button>
        {custom && (
          <button className="ghost-btn line-reset" onClick={() => put(auto)}>
            자동으로
          </button>
        )}
      </div>
      <p className="rooms-hint">
        이 숫자보다 많이 나오면 오버, 적게 나오면 언더입니다. 빡겜이면 올리고 즐겜이면
        내려보세요. 어떤 숫자를 적어도 <b>.5</b>로 맞춰집니다 (딱 맞으면 무승부라서요).
      </p>
    </Modal>
  );
};

export default BetOpenModal;
