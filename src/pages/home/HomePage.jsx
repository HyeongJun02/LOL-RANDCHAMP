import React from 'react';
import { Link } from 'react-router-dom';
import { FaDice, FaArrowRight } from 'react-icons/fa';
import { READY_TOOLS, SOON_TOOLS } from '../../tools';
import RosterManager from './RosterManager';
import { usePageMeta, PAGE_META } from '../../seo';
import './HomePage.css';

/* --i 순서대로 슉슉 올라온다. 위에서 아래로 세는 값이라 순서를 바꾸면 여기도 같이 바꿀 것 */
const step = (i) => ({ '--i': i });
const READY_FROM = 5;
const SOON_FROM = READY_FROM + READY_TOOLS.length + 1;
const ROSTER_AT = SOON_FROM + SOON_TOOLS.length;

const HomePage = () => {
  usePageMeta(PAGE_META.home);

  return (
  <div className="home-page">
    <section className="hero">
      <span className="home-kicker rise" style={step(0)}>
        롤 내전 도구 모음
      </span>
      <FaDice className="hero-icon rise" style={step(1)} />
      <h1 className="hero-title rise" style={step(2)}>
        롤랜챔
      </h1>
      <p className="hero-subtitle rise" style={step(3)}>
        <strong>내전 팀 짜기</strong>, <strong>랜덤 챔피언 뽑기</strong>,{' '}
        <strong>라인 분배</strong>까지. 정하기 귀찮은 건 전부 주사위한테 맡기세요.
      </p>
      <ul className="hero-badges rise" style={step(4)}>
        <li>로그인 없음</li>
        <li>화면 공유하고 같이 보기 좋음</li>
        <li>모바일 지원</li>
      </ul>
    </section>

    <section className="tool-section">
      <h2 className="section-title rise" style={step(READY_FROM - 1)}>
        지금 쓸 수 있는 도구
        <span className="section-count">{READY_TOOLS.length}</span>
      </h2>
      <div className="feature-grid">
        {READY_TOOLS.map((t, i) => (
          <Link
            to={t.to}
            key={t.to}
            className={`feature-card rise accent-${t.accent}`}
            style={step(READY_FROM + i)}
          >
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
      <h2 className="section-title rise" style={step(SOON_FROM - 1)}>
        준비 중
        <span className="section-count">{SOON_TOOLS.length}</span>
      </h2>
      <div className="feature-grid soon-grid">
        {SOON_TOOLS.map((t, i) => (
          <div
            key={t.name}
            className={`feature-card rise is-soon accent-${t.accent}`}
            style={step(SOON_FROM + i)}
          >
            <span className="feature-icon">{t.icon}</span>
            <h3 className="feature-title">{t.title}</h3>
            <p className="feature-desc">{t.desc}</p>
            <span className="feature-cta">준비 중</span>
          </div>
        ))}
      </div>
    </section>

    <RosterManager className="rise" style={step(ROSTER_AT)} />

    <footer className="footer rise" style={step(ROSTER_AT + 1)}>
      © {new Date().getFullYear()} 롤랜챔 · Made by @HyeongJun02
    </footer>
  </div>
  );
};

export default HomePage;
