import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaChevronDown, FaPlus, FaCircle } from 'react-icons/fa';
import { useMyRooms } from '../../server/rooms';
import Emblem from '../../components/common/Emblem';

/* 방 이름을 눌러 다른 방으로 바로 넘어간다.

   전에는 방을 옮기려면 뒤로 → 방 목록 → 다른 방, 세 번을 거쳐야 했다.
   여러 방에 들어가 있는 사람일수록 그 왕복을 자주 한다.

   목록은 열 때 처음 받는다. 방 화면에 들어올 때마다 미리 받아두면
   한 방만 쓰는 사람도 매번 값을 치른다 */
const RoomSwitch = ({ room, userId, children }) => {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  /* 닫혀 있는 동안은 요청을 안 보낸다 */
  const { rooms, loading } = useMyRooms(open ? userId : null, open);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!box.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const others = rooms.filter((r) => r.id !== room.id);

  return (
    <div className="room-switch" ref={box}>
      <button
        className={`room-switch-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {children}
        <FaChevronDown className="room-switch-caret" />
      </button>

      {open && (
        <div className="room-switch-menu" role="menu">
          {loading ? (
            <p className="room-switch-empty">불러오는 중…</p>
          ) : others.length === 0 ? (
            <p className="room-switch-empty">들어간 방이 여기뿐이에요.</p>
          ) : (
            others.map((r) => (
              <Link
                key={r.id}
                className="room-switch-item"
                to={`/rooms/${r.id}`}
                onClick={() => setOpen(false)}
              >
                <Emblem className="room-switch-emblem" value={r.emblem} />
                <span className="room-switch-name">{r.name}</span>
                {/* 또또가 돌고 있는 방은 여기서 바로 보여야 옮겨갈 이유가 된다 */}
                {r.live && <FaCircle className="room-switch-live" title="또또 진행 중" />}
              </Link>
            ))
          )}

          <Link className="room-switch-more" to="/rooms" onClick={() => setOpen(false)}>
            <FaPlus /> 방 목록으로
          </Link>
        </div>
      )}
    </div>
  );
};

export default RoomSwitch;
