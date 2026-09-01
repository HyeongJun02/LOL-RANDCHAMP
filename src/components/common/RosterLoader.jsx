import React, { useState } from 'react';
import { useRoster } from '../../roster';
import { getTier, tierName } from '../../tiers';
import Modal from './Modal';
import './RosterLoader.css';

/* 저장된 팀원을 체크해서 참가자 목록을 통째로 맞춘다.
   체크를 풀면 이미 들어가 있던 사람도 빠진다.
   present: 지금 참가자로 들어가 있는 이름들
   limit:   명단에서 채울 수 있는 최대 인원 (없으면 무제한) */
const RosterLoader = ({ present = [], limit, onConfirm, onClose }) => {
  const roster = useRoster();
  const presentNames = new Set(present.map((n) => n.trim()).filter(Boolean));

  const [picked, setPicked] = useState(() =>
    roster.filter((m) => presentNames.has(m.name.trim())).map((m) => m.id)
  );

  const atLimit = limit !== undefined && picked.length >= limit;

  const toggle = (id) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const allSelected = roster.length > 0 && picked.length === roster.length;
  const selectAll = () =>
    setPicked(allSelected ? [] : roster.slice(0, limit ?? roster.length).map((m) => m.id));

  const confirm = () => {
    onConfirm(roster.filter((m) => picked.includes(m.id)));
    onClose();
  };

  return (
    <Modal
      title="명단에서 불러오기"
      desc={
        limit === undefined
          ? '체크한 팀원이 참가자가 됩니다. 체크를 풀면 빠집니다.'
          : `체크한 팀원이 참가자가 됩니다. 체크를 풀면 빠집니다. 최대 ${limit}명.`
      }
      onClose={onClose}
      size="modal-sm"
      footer={
        <>
          <span className="loader-count">
            {picked.length > 0 ? `${picked.length}명 선택` : '선택 없음'}
          </span>
          <button className="ghost-btn" onClick={onClose}>
            취소
          </button>
          <button className="loader-confirm" onClick={confirm}>
            완료
          </button>
        </>
      }
    >
      {roster.length === 0 ? (
        <p className="loader-blank">
          저장된 팀원이 없습니다. 홈 화면의 &lsquo;내 팀원 명단&rsquo;에서 먼저 추가하세요.
        </p>
      ) : (
        <>
          <button className="loader-all" onClick={selectAll}>
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>

          <ul className="loader-list">
            {roster.map((m) => {
              const checked = picked.includes(m.id);
              return (
                <li key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={atLimit && !checked}
                      onChange={() => toggle(m.id)}
                    />
                    <span className="loader-name">{m.name || '(이름 없음)'}</span>
                    <span
                      className="loader-tier"
                      style={{ '--tier': getTier(m.tier).color }}
                    >
                      {tierName(m)}
                    </span>
                    {m.lines?.length > 0 && (
                      <span className="loader-lines">밴 {m.lines.join(' · ')}</span>
                    )}
                    {presentNames.has(m.name.trim()) && (
                      <span className="loader-added">참가 중</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
};

export default RosterLoader;
