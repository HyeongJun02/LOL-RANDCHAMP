// components/Header.jsx
import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="logo">
        <img src="/logo.png" alt="logo" />
        <h1>롤랜챔</h1>
      </div>
    </header>
  );
};

export default Header;
