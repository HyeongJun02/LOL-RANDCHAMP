import React from 'react';
import { Link } from 'react-router-dom';
import { FaDice, FaArrowRight } from 'react-icons/fa';
import { READY_TOOLS, SOON_TOOLS } from '../../tools';
import RosterManager from './RosterManager';
import './HomePage.css';

const HomePage = () => (
  <div className="home-page">
    <section className="hero">
      <span className="home-kicker">🎮 롤 친구 도구 모음</span>
      <FaDice className="hero-icon" />
      <h1 className="hero-title">롤랜챔</h1>
      <p className="hero-subtitle">
        친구들이랑 롤 할 때 필요한 잡다한 것들.{' '}
        <strong>정하기 귀찮은 건 전부 주사위한테</strong> 맡기세요.
      </p>
      <ul className="hero-badges">
        <li>로그인 없음</li>
        <li>화면 공유하고 같이 보기 좋음</li>
        <li>모바일 지원</li>
      </ul>
    </section>

    <section className="tool-section">
      <h2 className="section-title">
        지금 쓸 수 있는 도구
        <span className="section-count">{READY_TOOLS.length}</span>
      </h2>
      <div className="feature-grid">
        {READY_TOOLS.map((t) => (
          <Link to={t.to} key={t.to} className={`feature-card accent-${t.accent}`}>
            <span className="feature-icon">{t.icon}</span>
            <h3 className="feature-title">{t.title}</h3>
            <p className="feature-desc">{t.desc}</p>
            <span className="feature-cta">
              시작하기 <FaArrowRight />
            </span>
          </Link>
        ))}
      </div>
    </section>

    <section className="tool-section">
      <h2 className="section-title">
        준비 중
        <span className="section-count">{SOON_TOOLS.length}</span>
      </h2>
      <div className="feature-grid soon-grid">
        {SOON_TOOLS.map((t) => (
          <div key={t.name} className={`feature-card is-soon accent-${t.accent}`}>
            <span className="feature-icon">{t.icon}</span>
            <h3 className="feature-title">{t.title}</h3>
            <p className="feature-desc">{t.desc}</p>
            <span className="feature-cta">준비 중</span>
          </div>
        ))}
      </div>
    </section>

    <RosterManager />

    <footer className="footer">
      © {new Date().getFullYear()} 롤랜챔 · Made by Aodwns
    </footer>
  </div>
);

export default HomePage;
