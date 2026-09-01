import React, { useState } from 'react';
import { useRoster } from '../../roster';
import { getTier, tierName } from '../../tiers';
import Modal from './Modal';
import './RosterLoader.css';

/* 저장된 팀원을 체크해서 한 번에 참가자로 넣는다.
   taken: 이미 들어가 있는 이름들 / limit: 더 넣을 수 있는 인원 (없으면 무제한) */
const RosterLoader = ({ taken = [], limit, onConfirm, onClose }) => {
  const roster = useRoster();
  const [picked, setPicked] = useState([]);

  const takenNames = new Set(taken.map((n) => n.trim()).filter(Boolean));
  const available = roster.filter((m) => !takenNames.has(m.name.trim()));
  const atLimit = limit !== undefined && picked.length >= limit;

  const toggle = (id) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const allSelected = available.length > 0 && picked.length === available.length;
  const selectAll = () =>
    setPicked(
      allSelected
        ? []
        : available.slice(0, limit ?? available.length).map((m) => m.id)
    );

  const confirm = () => {
    onConfirm(roster.filter((m) => picked.includes(m.id)));
    onClose();
  };

  return (
    <Modal
      title="명단에서 불러오기"
      desc={
        limit === undefined
          ? '체크한 팀원이 참가자로 들어갑니다.'
          : `체크한 팀원이 참가자로 들어갑니다. 남은 자리 ${limit}명.`
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
          <button className="loader-confirm" onClick={confirm} disabled={picked.length === 0}>
            완료
          </button>
        </>
      }
    >
      {roster.length === 0 && (
        <p className="loader-blank">
          저장된 팀원이 없습니다. 홈 화면의 &lsquo;내 팀원 명단&rsquo;에서 먼저 추가하세요.
        </p>
      )}

      {roster.length > 0 && available.length === 0 && (
        <p className="loader-blank">저장된 팀원이 모두 들어가 있습니다.</p>
      )}

      {available.length > 0 && (
        <button className="loader-all" onClick={selectAll}>
          {allSelected ? '전체 해제' : '전체 선택'}
        </button>
      )}

      <ul className="loader-list">
        {roster.map((m) => {
          const already = takenNames.has(m.name.trim());
          const checked = picked.includes(m.id);
          const blocked = already || (atLimit && !checked);

          return (
            <li key={m.id} className={already ? 'is-added' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={blocked}
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
                {already && <span className="loader-added">추가됨</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
};

export default RosterLoader;
