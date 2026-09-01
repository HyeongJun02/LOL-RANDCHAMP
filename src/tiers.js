/* ------------------------------------------------------------------
   평점 스케일은 티어를 등간격으로 놓지 않는다.

   랭크는 실력이 아니라 '상위 몇 %'라서, 인구가 몰린 구간(실버~에메랄드)은
   한 티어 차이가 작고 꼬리(아이언, 마스터 이상)는 크다.
   그래서 2026-09 솔로랭크 분포를 백분위로 바꾸고, 정규분포 z점수로 환산해
   ×10 한 값을 평점으로 쓴다. 아이언4가 0점.

   실제로 아이언→브론즈 격차(z 1.07)가 골드→플래티넘(0.55)의 두 배다.

   분포 출처: esportstales.com / nerfplz.com (2026-08 기준)
     아이언 5% · 브론즈 21% · 실버 27% · 골드 20% · 플래 13%
     에메 8% · 다이아 3% · 마스터 0.7% · 그마 0.07%

   한 티어 안에서는 네 디비전을 균등하게 나눴다. 실제로는 하위 디비전에
   사람이 더 몰리지만, 그 차이까지 반영할 만한 공개 데이터가 없다.
   ------------------------------------------------------------------ */

/* ratings는 4 → 1 디비전 순. 디비전이 없는 티어는 한 칸만 둔다 */
const tier = (key, label, color, ratings) => ({
  key,
  label,
  color,
  ratings,
  divisions: ratings.length > 1 ? 4 : 0,
});

export const TIERS = [
  tier('IRON', '아이언', '#7d7268', [0, 4, 6, 8]),
  tier('BRONZE', '브론즈', '#a4714a', [11, 14, 16, 18]),
  tier('SILVER', '실버', '#9aa4b0', [20, 22, 23, 25]),
  tier('GOLD', '골드', '#e0b649', [27, 28, 29, 31]),
  tier('PLATINUM', '플래티넘', '#4bb3a8', [32, 33, 34, 36]),
  tier('EMERALD', '에메랄드', '#3fbf6f', [37, 38, 40, 41]),
  tier('DIAMOND', '다이아', '#6f8ff5', [43, 44, 46, 48]),
  tier('MASTER', '마스터', '#b45cf0', [51]),
  tier('GRANDMASTER', '그랜드마스터', '#e04b4b', [57]),
];

export const DIVISIONS = [4, 3, 2, 1];

export const getTier = (key) => TIERS.find((t) => t.key === key) || TIERS[0];

/* 디비전은 숫자가 작을수록 상위(골드1 > 골드4) */
export const ratingOf = ({ tier: key, division }) => {
  const t = getTier(key);
  if (t.divisions === 0) return t.ratings[0];
  const idx = 4 - (Number(division) || 4);
  return t.ratings[Math.min(3, Math.max(0, idx))];
};

export const tierName = ({ tier: key, division }) => {
  const t = getTier(key);
  return t.divisions ? `${t.label} ${division}` : t.label;
};
