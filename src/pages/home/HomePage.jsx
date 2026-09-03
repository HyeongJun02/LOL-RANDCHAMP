import React from 'react';
import { Link } from 'react-router-dom';
import { FaDice, FaArrowRight } from 'react-icons/fa';
import { TOOL_SECTIONS, SOON_TOOLS } from '../../tools';
import RosterManager from './RosterManager';
import { usePageMeta, PAGE_META } from '../../seo';
import './HomePage.css';

/* --i 순서대로 올라온다. 섹션 개수가 바뀌어도 알아서 이어지도록 계산해서 넘긴다 */
const step = (i) => ({ '--i': i });
const HERO_STEPS = 4;

const ToolCard = ({ tool, delay }) => (
  <Link
    to={tool.to}
    className={`feature-card rise accent-${tool.accent}`}
    style={step(delay)}
  >
    <span className="feature-icon">{tool.icon}</span>
    <h3 className="feature-title">{tool.title}</h3>
    <p className="feature-desc">{tool.desc}</p>
    <span className="feature-cta">
      시작하기 <FaArrowRight />
    </span>
  </Link>
);

const HomePage = () => {
  usePageMeta(PAGE_META.home);

  /* 섹션마다 제목 1 + 카드 n 만큼 순번을 먹는다 */
  let cursor = HERO_STEPS;
  const sections = TOOL_SECTIONS.map((s) => {
    const at = { title: cursor, cards: cursor + 1 };
    cursor += 1 + s.tools.length;
    return { ...s, at };
  });
  const soonAt = { title: cursor, cards: cursor + 1 };
  cursor += 1 + SOON_TOOLS.length;
  const rosterAt = cursor;

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
          친구들이랑 내전할 때 필요한 것들.
          <br />
          팀 짜고, 라인 정하고, 챔피언 뽑고, 전적까지 남긴다.
        </p>
      </section>

      {sections.map((s) => (
        <section className="tool-section" key={s.key}>
          <h2 className="section-title rise" style={step(s.at.title)}>
            {s.label}
            <span className="section-count">{s.tools.length}</span>
          </h2>
          <div className="feature-grid">
            {s.tools.map((t, i) => (
              <ToolCard key={t.to} tool={t} delay={s.at.cards + i} />
            ))}
          </div>
        </section>
      ))}

      <section className="tool-section">
        <h2 className="section-title rise" style={step(soonAt.title)}>
          준비 중
          <span className="section-count">{SOON_TOOLS.length}</span>
        </h2>
        <div className="feature-grid soon-grid">
          {SOON_TOOLS.map((t, i) => (
            <div
              key={t.name}
              className={`feature-card rise is-soon accent-${t.accent}`}
              style={step(soonAt.cards + i)}
            >
              <span className="feature-icon">{t.icon}</span>
              <h3 className="feature-title">{t.title}</h3>
              <p className="feature-desc">{t.desc}</p>
              <span className="feature-cta">준비 중</span>
            </div>
          ))}
        </div>
      </section>

      <RosterManager className="rise" style={step(rosterAt)} />

      <footer className="footer rise" style={step(rosterAt + 1)}>
        © {new Date().getFullYear()} 롤랜챔 · Made by @HyeongJun02
      </footer>
    </div>
  );
};

export default HomePage;
