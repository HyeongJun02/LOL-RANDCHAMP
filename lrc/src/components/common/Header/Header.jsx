import React from 'react';
import { Link } from 'react-router-dom'; // React Router의 Link 컴포넌트 import
import { FaDice } from 'react-icons/fa'; // <FaDice className="dice-icon" />
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <Link to="/" className="logo">
        <FaDice className="dice-icon" />
        <img src="/site_icon/LRC_logo.png" alt="logo" />
      </Link>
      <nav className="nav-menu">
        <Link to="/random-champion" className="nav-link">
          챔피언 랜덤 선택
        </Link>
        <Link to="/random-line" className="nav-link">
          라인 랜덤 분배
        </Link>
      </nav>
    </header>
  );
};

export default Header;
