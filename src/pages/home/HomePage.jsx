import React from 'react';
import { Link } from 'react-router-dom';
import { FaDice, FaRandom, FaArrowRight } from 'react-icons/fa';
import { GiPathDistance } from 'react-icons/gi';
import './HomePage.css';

const FEATURES = [
  {
    to: '/random-champion',
    icon: <FaRandom />,
    title: '챔피언 랜덤 선택',
    desc: '뭐 할지 고민될 땐 그냥 운명에 맡기자. 역할군 필터링도 가능!',
    accent: 'blue',
  },
  {
    to: '/random-line',
    icon: <GiPathDistance />,
    title: '라인 랜덤 분배',
    desc: '가기 싫은 라인은 미리 밴하고, 나머지는 주사위에 맡겨보자.',
    accent: 'gold',
  },
];

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="gg-aurora" aria-hidden="true">
        <span className="gg-blob gg-blob-gold home-blob-1" />
        <span className="gg-blob gg-blob-blue home-blob-2" />
      </div>
      <div className="gg-hexbg" aria-hidden="true" />
      <div className="gg-grain" aria-hidden="true" />

      <div className="hero">
        <span className="home-kicker">🎮 롤 친구 도구 모음</span>
        <FaDice className="hero-icon" />
        <h1 className="hero-title">롤랜챔</h1>
        <p className="hero-subtitle">
          간단하게 <strong>챔피언을 랜덤으로 선택</strong>하거나,{' '}
          <strong>라인을 랜덤으로 분배</strong>해보세요.
        </p>
      </div>

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <Link to={f.to} className={`feature-card accent-${f.accent}`} key={f.to}>
            <span className="feature-icon">{f.icon}</span>
            <h2 className="feature-title">{f.title}</h2>
            <p className="feature-desc">{f.desc}</p>
            <span className="feature-cta">
              시작하기 <FaArrowRight />
            </span>
          </Link>
        ))}
      </div>

      <footer className="footer">
        © {new Date().getFullYear()} 롤랜챔 | Made with by Aodwns
      </footer>
    </div>
  );
};

export default HomePage;
