import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaDice, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { READY_TOOLS } from '../../../tools';
import { useAuth } from '../../../auth/AuthContext';
import AuthModal from '../../auth/AuthModal';
import './Header.css';

const Header = () => {
  const { user, loading, configured, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

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
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <FaDice className="dice-icon" />
          <span className="logo-text">롤랜챔</span>
          <span className="logo-tag">LRC</span>
        </Link>

        <nav className="nav-menu">
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
        </nav>

        {configured && !loading && (
          <div className="header-auth">
            {user ? (
              <div className="user-chip">
                <FaUserCircle className="user-icon" />
                <span className="user-name">{user.name || user.email}</span>
                <button className="user-signout" onClick={handleSignOut} aria-label="로그아웃" title="로그아웃">
                  <FaSignOutAlt />
                </button>
              </div>
            ) : (
              <button className="login-btn" onClick={() => setShowAuth(true)}>
                로그인
              </button>
            )}
          </div>
        )}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </header>
  );
};

export default Header;
