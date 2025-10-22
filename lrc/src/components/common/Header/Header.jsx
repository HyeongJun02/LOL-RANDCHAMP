import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaDice, FaRandom } from 'react-icons/fa';
import { GiPathDistance } from 'react-icons/gi';
import './Header.css';

const Header = () => {
  const location = useLocation();

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <FaDice className="dice-icon" />
          <span className="logo-text">LRC</span>
        </Link>

        <nav className="nav-menu">
          <Link
            to="/random-champion"
            className={`nav-link ${
              location.pathname === '/random-champion' ? 'active' : ''
            }`}
          >
            <FaRandom className="nav-icon" />
            챔피언 랜덤
          </Link>

          <Link
            to="/random-line"
            className={`nav-link ${
              location.pathname === '/random-line' ? 'active' : ''
            }`}
          >
            <GiPathDistance className="nav-icon" />
            라인 분배
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
