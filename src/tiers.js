/* 평점 스케일: 디비전 한 칸 = 1점. 티어 하나 = 4점.
   ponytail: 마스터 이상은 디비전이 없고 실력 격차가 크므로 간격을 벌려뒀다.
   체감이 안 맞으면 base 값만 손보면 된다. */
export const TIERS = [
  { key: 'IRON', label: '아이언', color: '#7d7268', base: 0, divisions: 4 },
  { key: 'BRONZE', label: '브론즈', color: '#a4714a', base: 4, divisions: 4 },
  { key: 'SILVER', label: '실버', color: '#9aa4b0', base: 8, divisions: 4 },
  { key: 'GOLD', label: '골드', color: '#e0b649', base: 12, divisions: 4 },
  { key: 'PLATINUM', label: '플래티넘', color: '#4bb3a8', base: 16, divisions: 4 },
  { key: 'EMERALD', label: '에메랄드', color: '#3fbf6f', base: 20, divisions: 4 },
  { key: 'DIAMOND', label: '다이아', color: '#6f8ff5', base: 24, divisions: 4 },
  { key: 'MASTER', label: '마스터', color: '#b45cf0', base: 30, divisions: 0 },
  { key: 'GRANDMASTER', label: '그랜드마스터', color: '#e04b4b', base: 34, divisions: 0 },
];

export const DIVISIONS = [4, 3, 2, 1];

export const getTier = (key) => TIERS.find((t) => t.key === key) || TIERS[0];

/* 디비전은 숫자가 작을수록 상위(골드1 > 골드4) */
export const ratingOf = ({ tier, division }) => {
  const t = getTier(tier);
  return t.divisions ? t.base + (t.divisions - division) : t.base;
};

export const tierName = ({ tier, division }) => {
  const t = getTier(tier);
  return t.divisions ? `${t.label} ${division}` : t.label;
};
