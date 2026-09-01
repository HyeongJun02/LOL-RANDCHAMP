import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FaDice } from 'react-icons/fa';
import { READY_TOOLS } from '../../../tools';
import './Header.css';

const Header = () => (
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
          >
            <span className="nav-icon">{t.icon}</span>
            <span>{t.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  </header>
);

export default Header;
