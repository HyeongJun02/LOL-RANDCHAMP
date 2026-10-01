import React, { useState } from 'react';
import { FaDice } from 'react-icons/fa';
import Modal from '../../components/common/Modal';
import { killLineFor } from '../../server/rooms';
import { useGameKey } from '../../lib/GameContext';
import { CLOSE_PRESETS as PRESETS } from '../../rules/tuning';
import KillLinePicker from './KillLinePicker';

/* 또또를 열기 전에 방장이 정하는 것들.

   배팅 시간: '직접 마감'이 기본이다. 시간을 정해두면 방장이 잊어도 알아서
   닫히지만, 경기 시작이 늦어지는 일이 잦아서 강제하지는 않는다.

   총 킬 기준선: 인원으로 자동 계산하지만, 그날 분위기(빡겜/즐겜)에 따라
   실제 킬 수가 꽤 달라진다. 열기 전에 손으로 올리고 내릴 수 있게 둔다. */

export const ClosePresets = ({ seconds, onChange }) => (
  <>
    <p className="bet-open-label">배팅 시간</p>
    <div className="bet-open-presets">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          className={`ghost-btn ${seconds === p.seconds ? 'is-on' : ''}`}
          onClick={() => onChange(p.seconds)}
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
  </>
);

export const LINE_HINT = (
  <p className="rooms-hint">
    이 숫자보다 많이 나오면 오버, 적게 나오면 언더입니다. 빡겜이면 올리고 즐겜이면
    내려보세요. 어떤 숫자를 적어도 <b>.5</b>로 맞춰집니다 (딱 맞으면 무승부라서요).
  </p>
);

const BetOpenModal = ({ onClose, onOpen, playerCount, mode }) => {
  const game = useGameKey();
  const auto = killLineFor(playerCount, game, mode);
  const [seconds, setSeconds] = useState(null);
  const [line, setLine] = useState(auto);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      /* 자동값 그대로면 굳이 박아두지 않는다. 비워두면 화면이 인원으로 계산한다 */
      await onOpen(seconds, line !== auto ? line : null);
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
      <ClosePresets seconds={seconds} onChange={setSeconds} />

      <p className="bet-open-label" style={{ marginTop: '1rem' }}>
        총 킬 기준선
      </p>
      <KillLinePicker
        value={line}
        auto={auto}
        autoLabel={`${playerCount}명 기준 자동`}
        onChange={setLine}
      />
      {LINE_HINT}
    </Modal>
  );
};

export default BetOpenModal;
