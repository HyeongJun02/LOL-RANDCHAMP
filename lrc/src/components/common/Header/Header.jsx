// components/Header.jsx
import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="logo">
        <img src="/site_icon/lol_icon.png" alt="logo" />
        <h1>정희준을 위한 롤랜챔</h1>
      </div>
    </header>
  );
};

export default Header;
