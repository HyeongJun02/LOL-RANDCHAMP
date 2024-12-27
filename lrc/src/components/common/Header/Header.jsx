import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="logo">
        <img src="/site_icon/lol_icon.png" alt="logo" />
        <h1>롤 랜덤 챔피언 선택기</h1>
      </div>
    </header>
  );
};

export default Header;
