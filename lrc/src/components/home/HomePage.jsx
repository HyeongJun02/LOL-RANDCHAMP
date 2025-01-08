import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page">
      <h1>롤랜챔에 오신 것을 환영합니다!</h1>
      <div className="button-container">
        <Link to="/main" className="navigation-button">
          챔피언 랜덤 선택
        </Link>
      </div>
    </div>
  );
};

export default HomePage;
