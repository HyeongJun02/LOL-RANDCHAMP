import React, { useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaSignOutAlt, FaUserFriends } from 'react-icons/fa';
import { openRosterModal } from '../../rosterModal';
import './UserMenu.css';

const initialOf = (user) =>
  (user.name || user.email || '?').trim().charAt(0).toUpperCase();

/* 구글 프로필 사진. 없거나 못 불러오면 이름 첫 글자로 떨어진다.
   lh3.googleusercontent.com은 referrer가 붙으면 403을 주는 경우가 있어 꺼둔다 */
const Avatar = ({ user, broken, onBroken }) =>
  user.image && !broken ? (
    <img src={user.image} alt="" referrerPolicy="no-referrer" onError={onBroken} />
  ) : (
    <span className="avatar-letter">{initialOf(user)}</span>
  );

const UserMenu = ({ user, onSignOut }) => {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const box = useRef(null);

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

  const avatar = <Avatar user={user} broken={broken} onBroken={() => setBroken(true)} />;

  return (
    <div className="user-menu" ref={box}>
      <button
        className={`user-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.name || user.email}
      >
        <span className="user-avatar">{avatar}</span>
        <span className="user-name">{user.name || user.email}</span>
        <FaChevronDown className="user-caret" />
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-info">
            <span className="user-avatar lg">{avatar}</span>
            <span className="user-text">
              <strong>{user.name || '이름 없음'}</strong>
              <em>{user.email}</em>
            </span>
          </div>
          <button
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openRosterModal();
            }}
          >
            <FaUserFriends /> 내 팀원 명단
          </button>
          <button
            className="user-signout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <FaSignOutAlt /> 로그아웃
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
