import React from 'react';
import {
  FaFire,
  FaSnowflake,
  FaHandshake,
  FaSkull,
  FaMedal,
  FaBolt,
  FaCrosshairs,
  FaCalendarDay,
  FaGhost,
  FaBalanceScale,
} from 'react-icons/fa';
import { PAIR_MIN } from './insightData';

const ICONS = {
  hot: <FaFire />,
  cold: <FaSnowflake />,
  best: <FaMedal />,
  duo: <FaHandshake />,
  worstDuo: <FaHandshake />,
  mostDuo: <FaHandshake />,
  rival: <FaSkull />,
  even: <FaBalanceScale />,
  mostMet: <FaSkull />,
  underdog: <FaBolt />,
  breaker: <FaCrosshairs />,
  iron: <FaMedal />,
  busiest: <FaCalendarDay />,
  ghost: <FaGhost />,
};

const Insights = ({ items }) => (
  <div className="insight-grid">
    {items.map((it) => (
      <div className="insight" key={it.key}>
        <span className="insight-head">
          {ICONS[it.key]} {it.label}
        </span>
        {it.value ? (
          <span className="insight-main">{it.value}</span>
        ) : (
          <span className="insight-empty">아직 없음</span>
        )}
        {it.value && it.hint && <em className="insight-hint">{it.hint}</em>}
      </div>
    ))}

    <p className="insight-note">
      짝 통계는 {PAIR_MIN}판 이상 함께한 경우만 셉니다. 한두 판으로 100%가 뜨면 의미가
      없어서요.
    </p>
  </div>
);

export default Insights;
