import React from 'react';
import { FaDice } from 'react-icons/fa'; // <FaDice className="dice-icon" />
import './HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page">
      <FaDice className="dice-icon" />
      <h1>롤랜챔에 오신 것을 환영합니다!</h1>
      <h4>상단의 메뉴에서 원하는 기능을 선택하세요.</h4>
    </div>
  );
};

export default HomePage;
