import React, { useState, useLayoutEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaDice } from 'react-icons/fa';
import { READY_TOOLS } from '../../../tools';
import { useAuth } from '../../../auth/AuthContext';
import AuthModal from '../../auth/AuthModal';
import UserMenu from '../../auth/UserMenu';
import './Header.css';

const Header = () => {
  const { user, loading, configured, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const box = useRef(null);

  /* 헤더가 두 줄이라 높이가 화면 폭에 따라 바뀐다. sticky로 붙는 것들이
     이 값을 알아야 해서 실측해 --header-h로 흘린다 (매직넘버 방지) */
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const apply = () =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* AuthContext는 UI를 몰라야 해서 여기서 실패 피드백을 준다.
     안 잡으면 네트워크 오류 때 로그아웃이 조용히 실패하고 사용자는
     로그인 칩이 그대로 떠 있는 이유를 알 방법이 없다 */
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast.error('로그아웃에 실패했어요. 다시 시도해 주세요.');
    }
  };

  return (
    <header className="header" ref={box}>
      <div className="header-top">
        <Link to="/" className="logo">
          <FaDice className="dice-icon" />
          <span className="logo-text">롤랜챔</span>
          <span className="logo-tag">LRC</span>
        </Link>

        {configured && !loading && (
          <div className="header-auth">
            {user ? (
              <UserMenu user={user} onSignOut={handleSignOut} />
            ) : (
              <button className="login-btn" onClick={() => setShowAuth(true)}>
                로그인
              </button>
            )}
          </div>
        )}
      </div>

      {/* 도구가 늘어나면 이 줄만 길어진다. 넘치면 가로로 스크롤된다 */}
      <nav className="header-nav">
        <div className="nav-menu">
          {READY_TOOLS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              title={t.name}
              aria-label={t.name}
            >
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.name}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </header>
  );
};

export default Header;
