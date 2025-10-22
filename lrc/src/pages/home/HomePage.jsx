import React from 'react';
import { Link } from 'react-router-dom';
import { FaDice, FaRandom } from 'react-icons/fa';
import { GiPathDistance } from 'react-icons/gi';
import './HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="hero">
        <FaDice className="hero-icon" />
        <h1 className="hero-title">롤랜챔에 오신 것을 환영합니다!</h1>
        <p className="hero-subtitle">
          간단하게 <strong>챔피언을 랜덤으로 선택</strong>하거나,
          <strong>라인을 랜덤으로 분배</strong>해보세요.
        </p>

        <div className="button-container">
          <Link to="/random-champion" className="navigation-button">
            <FaRandom /> 챔피언 랜덤 선택
          </Link>
          <Link to="/random-line" className="navigation-button secondary">
            <GiPathDistance /> 라인 랜덤 분배
          </Link>
        </div>
      </div>

      <footer className="footer">
        © {new Date().getFullYear()} 롤랜챔 | Made with by Aodwns
      </footer>
    </div>
  );
};

export default HomePage;
