/* 게임.

   방을 만들 때 어떤 게임의 내전인지 고른다. 게임마다 티어 체계가 다르고
   (롤은 디비전 4칸, 발로란트는 3칸), 라인 개념도 롤에만 있다.
   그래서 '게임'이 화면 곳곳의 기준이 된다.

   방마다 게임이 하나로 고정된다. 한 방에서 롤도 하고 발로란트도 하면
   전적과 티어 평점이 섞여서 팀 짜기가 의미를 잃는다. 게임을 바꾸려면
   방을 새로 만든다.

   ----------------------------------------------------------------
   평점 스케일은 티어를 등간격으로 놓지 않는다.

   랭크는 실력이 아니라 '상위 몇 %'라서, 인구가 몰린 구간은 한 티어 차이가
   작고 꼬리(아이언, 최상위)는 크다. 그래서 티어 분포를 백분위로 바꾸고
   정규분포 z점수로 환산해 ×10 한 값을 평점으로 쓴다. 제일 낮은 칸이 0점.

   꼭대기(롤 마스터 이상, 발로 불멸 이상)는 계산값보다 늘려 잡았다.
   백분위만 따르면 0.1%와 0.01%가 거의 붙어버리는데, 실제로 그 둘을 같은
   팀에 넣으면 게임이 안 된다.
   ---------------------------------------------------------------- */

/* ratings는 낮은 디비전 → 높은 디비전 순 (골드4, 골드3, 골드2, 골드1).
   디비전이 없는 티어는 한 칸만 둔다 */
const tier = (key, label, color, ratings) => ({
  key,
  label,
  color,
  ratings,
  /* 이 티어가 몇 칸으로 나뉘는지. 0이면 안 나뉜다 */
  divisions: ratings.length > 1 ? ratings.length : 0,
});

/* 롤: 2026-09 솔로랭크 분포 기준
   아이언 5% · 브론즈 21% · 실버 27% · 골드 20% · 플래 13%
   에메 8% · 다이아 3% · 마스터 0.7% · 그마 0.07% */
const LOL_TIERS = [
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

/* 발로란트: 경쟁전 분포 기준
   아이언 5% · 브론즈 15% · 실버 20% · 골드 19% · 플래 17%
   다이아 13% · 초월자 8% · 불멸 2.9% · 레디언트 0.1%

   롤과 달리 한 티어가 세 칸(1·2·3)이고, 에메랄드가 없는 대신
   다이아 위에 초월자가 있다. 레디언트는 서버별 상위 500명이라
   그랜드마스터보다도 좁은 자리다. */
const VALORANT_TIERS = [
  tier('IRON', '아이언', '#8a8a8a', [0, 4, 7]),
  tier('BRONZE', '브론즈', '#a1703c', [10, 12, 15]),
  tier('SILVER', '실버', '#b9c1c9', [17, 19, 21]),
  tier('GOLD', '골드', '#e8c46a', [22, 24, 25]),
  tier('PLATINUM', '플래티넘', '#4fc3d9', [27, 28, 30]),
  tier('DIAMOND', '다이아', '#c891e8', [32, 33, 35]),
  tier('ASCENDANT', '초월자', '#2fbd6e', [37, 39, 41]),
  tier('IMMORTAL', '불멸', '#d13b58', [45, 48, 51]),
  tier('RADIANT', '레디언트', '#ffe9a8', [60]),
];

export const GAMES = [
  {
    key: 'lol',
    label: '리그 오브 레전드',
    short: '롤',
    emoji: '⚔️',
    /* public/logo에 둔 파일. 배포 경로가 바뀌어도 따라오게 절대 경로 */
    logo: '/logo/lol-logo.png',
    /* 로고 옆이나 배경으로 옅게 깔 때 쓰는 그 게임의 색 */
    color: '#c8aa6e',
    tiers: LOL_TIERS,
    /* 숫자가 작을수록 상위 (골드1 > 골드4) */
    divisions: [4, 3, 2, 1],
    defaultTier: 'GOLD',
    teamSize: 5,
    /* 탑·정글·미드·원딜·서폿. 발로란트에는 이런 게 없다 */
    hasLines: true,
    /* 총 킬 언더/오버의 인당 기준. 발로란트는 라운드제라 킬이 훨씬 적다 */
    killsPerPlayer: 8.9,
  },
  {
    key: 'valorant',
    label: '발로란트',
    short: '발로',
    emoji: '🎯',
    logo: '/logo/valorant-logo.png',
    color: '#ff4655',
    tiers: VALORANT_TIERS,
    divisions: [3, 2, 1],
    defaultTier: 'GOLD',
    teamSize: 5,
    hasLines: false,
    /* 13라운드 선취라 한 판 총 킬이 대략 인당 4~5킬 언저리다 */
    killsPerPlayer: 4.5,
  },
];

export const DEFAULT_GAME = 'lol';

export const getGame = (key) => GAMES.find((g) => g.key === key) || GAMES[0];

/* ---------- 티어 ---------- */

export const tiersOf = (game) => getGame(game).tiers;
export const divisionsOf = (game) => getGame(game).divisions;

export const getTier = (game, key) => {
  const list = tiersOf(game);
  return list.find((t) => t.key === key) || list[0];
};

/* 그 게임에서 새 사람에게 줄 기본값 */
export const defaultTierOf = (game) => {
  const g = getGame(game);
  return { tier: g.defaultTier, division: g.divisions[0] };
};

/* 디비전은 숫자가 작을수록 상위. ratings는 낮은 칸부터라 뒤집어서 읽는다 */
export const ratingOf = (game, { tier: key, division }) => {
  const t = getTier(game, key);
  if (t.divisions === 0) return t.ratings[0];
  const idx = t.divisions - (Number(division) || t.divisions);
  return t.ratings[Math.min(t.ratings.length - 1, Math.max(0, idx))];
};

export const tierName = (game, { tier: key, division }) => {
  const t = getTier(game, key);
  return t.divisions ? `${t.label} ${division}` : t.label;
};

/* 게임을 바꿔 옮겨 적을 때. 없는 티어(롤 에메랄드 → 발로)는 기본값으로 */
export const fitTier = (game, member) => {
  const g = getGame(game);
  const has = g.tiers.some((t) => t.key === member.tier);
  const div = g.divisions.includes(Number(member.division))
    ? Number(member.division)
    : g.divisions[0];
  return has ? { tier: member.tier, division: div } : defaultTierOf(game);
};
