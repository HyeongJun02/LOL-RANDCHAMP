import React, { useState } from 'react';

/* 분마다 두 팀 골드 차이. 위로 솟으면 블루팀, 아래로 내려가면 레드팀이 앞선다.
   방향(위/아래)이 먼저 말하고 색은 거든다 - 색만으로 팀을 가르지 않는다.
   색은 어두운 배경에서 색약 검사(dataviz validator)를 통과한 두 값이다 */

const BLUE = '#5b8def';
const RED = '#e0575b';
const W = 12; // 한 분 칸의 폭 (viewBox 단위)
const H = 120;
const MID = H / 2;

const GoldChart = ({ diff = [] }) => {
  const [hover, setHover] = useState(null);
  if (diff.length < 2) return null;

  const max = Math.max(1000, ...diff.map((v) => Math.abs(v)));
  const scale = (MID - 6) / max;
  const width = diff.length * W;
  const last = diff[diff.length - 1];
  const shown = hover != null ? hover : diff.length - 1;
  const v = diff[shown];

  return (
    <figure className="riot-gold">
      <figcaption>
        <span>골드 차이</span>
        {/* 지금 가리킨 분(없으면 마지막) */}
        <b>
          {shown}분 ·{' '}
          {v === 0 ? '동률' : `${v > 0 ? '블루팀' : '레드팀'} +${Math.abs(v).toLocaleString()}`}
        </b>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`최종 골드 차이 ${last > 0 ? '블루팀' : '레드팀'} ${Math.abs(last).toLocaleString()}`}
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" x2={width} y1={MID} y2={MID} className="riot-gold-base" />
        {diff.map((val, i) => {
          const h = Math.max(1, Math.abs(val) * scale);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              {/* 막대보다 넓은 투명 칸이 마우스를 받는다 */}
              <rect x={i * W} y="0" width={W} height={H} fill="transparent" />
              <rect
                x={i * W + 2}
                y={val >= 0 ? MID - h : MID}
                width={W - 4}
                height={h}
                rx="2"
                fill={val >= 0 ? BLUE : RED}
                opacity={hover == null || hover === i ? 1 : 0.45}
              />
            </g>
          );
        })}
      </svg>
      <div className="riot-gold-legend">
        <span>
          <i style={{ background: BLUE }} /> 위 · 블루팀 우세
        </span>
        <span>
          <i style={{ background: RED }} /> 아래 · 레드팀 우세
        </span>
        <span className="riot-muted">최대 ±{max.toLocaleString()}</span>
      </div>
    </figure>
  );
};

export default GoldChart;
