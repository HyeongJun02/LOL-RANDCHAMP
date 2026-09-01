import React from 'react';

/* 내전 포인트 +/- 배지. 팀 분배와 내전 기록지에서 같이 쓴다 */
const ScrimBadge = ({ points }) => (
  <span className={`scrim-badge ${points > 0 ? 'pos' : points < 0 ? 'neg' : 'zero'}`}>
    {points > 0 ? `+${points}` : points}
  </span>
);

export default ScrimBadge;
