import React, { useState } from 'react';
import { FaDice } from 'react-icons/fa';
import Modal from '../../components/common/Modal';
import { killLineFor } from '../../rooms';

/* 또또를 열 때 배팅 시간을 정한다.

   '직접 마감'이 기본이다. 시간을 정해두면 방장이 잊어도 알아서 닫히지만,
   경기 시작이 늦어지는 일이 잦아서 강제하지는 않는다. */
import { CLOSE_PRESETS as PRESETS } from '../../tuning';

const BetOpenModal = ({ onClose, onOpen, playerCount }) => {
  const [seconds, setSeconds] = useState(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      await onOpen(seconds);
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

      <p className="rooms-hint">
        이번 경기 총 킬 기준선은 <strong>{killLineFor(playerCount)}</strong>입니다 (
        {playerCount}명 기준).
      </p>
    </Modal>
  );
};

export default BetOpenModal;
