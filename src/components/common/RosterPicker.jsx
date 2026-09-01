import React, { useState, useRef, useEffect } from 'react';
import { FaUserPlus } from 'react-icons/fa';
import { useRoster } from '../../roster';
import { tierName } from '../../tiers';
import './RosterPicker.css';

/* 이름 칸 옆에 붙는 작은 토글. 저장된 팀원 중 아직 안 들어간 사람만 보여준다.
   taken: 다른 칸에 이미 들어가 있는 이름들 */
const RosterPicker = ({ taken = [], onPick, title = '저장된 팀원 불러오기' }) => {
  const roster = useRoster();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (roster.length === 0) return null;

  const takenNames = new Set(taken.map((n) => n.trim()).filter(Boolean));
  const available = roster.filter((m) => !takenNames.has(m.name.trim()));

  return (
    <div className="roster-picker" ref={box}>
      <button
        type="button"
        className={`picker-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-label={title}
        aria-expanded={open}
      >
        <FaUserPlus />
      </button>

      {open && (
        <div className="picker-menu">
          {available.length === 0 ? (
            <p className="picker-empty">전부 들어가 있어요</p>
          ) : (
            available.map((m) => (
              <button
                type="button"
                key={m.id}
                className="picker-item"
                onClick={() => {
                  onPick(m);
                  setOpen(false);
                }}
              >
                <span>{m.name}</span>
                <em>{tierName(m)}</em>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default RosterPicker;
