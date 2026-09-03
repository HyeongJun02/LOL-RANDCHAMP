import React from 'react';

/* 내전 포인트 +/- 배지. 팀 분배와 내전 기록지에서 같이 쓴다.
   stat을 주면 이 사람 점수가 어떻게 나온 값인지 툴팁으로 풀어준다. */
const buildTitle = (points, stat) => {
  if (!stat) return `내전 포인트 ${points > 0 ? `+${points}` : points}`;
  const raw = Math.round(stat.raw * 10) / 10;
  return [
    `${stat.games}판 ${stat.wins}승 ${stat.losses}패`,
    `누적 ${raw > 0 ? `+${raw}` : raw} → 판수 보정 후 ${points > 0 ? `+${points}` : points}`,
    '상대가 셀수록 많이 오르고, 판수가 적으면 덜 반영합니다.',
  ].join('\n');
};

const ScrimBadge = ({ points, stat }) => (
  <span
    className={`scrim-badge ${points > 0 ? 'pos' : points < 0 ? 'neg' : 'zero'}`}
    title={buildTitle(points, stat)}
  >
    {points > 0 ? `+${points}` : points}
  </span>
);

export default ScrimBadge;
