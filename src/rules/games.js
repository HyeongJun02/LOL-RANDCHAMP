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

import { LINES, VALORANT_ROLES } from './lines';

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
    /* 줄여 부르지 않는다. '롤'·'발로'는 사람마다 다르게 쓴다 */
    label: '리그 오브 레전드',
    /* public/logo에 둔 파일. 배포 경로가 바뀌어도 따라오게 절대 경로 */
    logo: '/logo/lol-logo.png',
    /* 로고 옆이나 배경으로 옅게 깔 때 쓰는 그 게임의 색 */
    color: '#c8aa6e',
    tiers: LOL_TIERS,
    /* 낮은 칸부터 적는다. 롤은 숫자가 작을수록 상위라 4가 제일 아래다
       (골드4 → 골드1). 이 순서가 평점 계산과 화면 목록의 기준이 된다 */
    divisions: [4, 3, 2, 1],
    defaultTier: 'SILVER',
    teamSize: 5,
    /* 탑·정글·미드·원딜·서폿. 다섯 자리를 다섯 명이 하나씩 나눠 갖는다 */
    roles: LINES,
    roleLabel: '라인',
    uniqueRoles: true,
    /* 이름 칸이 비어 있을 때 띄우는 농담. 게임마다 통하는 말이 다르다 */
    sampleNames: ['제우스', '오너', '페이커', '구마유시', '케리아'],
    banHint: '가기 싫은 라인 밴하기',
    /* 내전 모드. 하나뿐이면 화면에 고르는 칸을 아예 안 그린다 */
    modes: [
      {
        key: 'normal',
        label: '내전',
        group: 'team',
        teamSize: 5,
        /* 총 킬 언더/오버의 인당 기준 */
        killsPerPlayer: 8.9,
      },
    ],
  },
  {
    key: 'valorant',
    label: '발로란트',
    logo: '/logo/valorant-logo.png',
    color: '#ff4655',
    tiers: VALORANT_TIERS,
    /* 발로란트는 롤과 반대로 숫자가 클수록 상위다 (브론즈1 → 브론즈3).
       여기도 '낮은 칸부터'라는 규칙은 같아서 1이 먼저 온다 */
    divisions: [1, 2, 3],
    defaultTier: 'SILVER',
    teamSize: 5,
    /* 역할이 넷인데 팀은 다섯이라 하나는 겹친다. 롤과 다른 점 */
    roles: VALORANT_ROLES,
    roleLabel: '역할',
    uniqueRoles: false,
    /* 역할이 넷인데 팀은 다섯이라 하나는 반드시 겹친다. 보통 타격대를
       둘 둔다. 화면에서 체크로 바꿀 수 있고 여기는 처음 값일 뿐이다 */
    defaultDoubles: ['타격대'],
    sampleNames: ['원딜러', '연막충', '벽잡이', '칼잡이', '설치왕'],
    banHint: '하기 싫은 역할 밴하기',
    modes: [
      {
        key: 'standard',
        label: '일반',
        desc: '5대5 (13선승)',
        group: 'team',
        teamSize: 5,
        /* 라운드제라 롤보다 킬이 훨씬 적다 */
        killsPerPlayer: 13.6,
      },
      {
        key: 'swift',
        label: '신속',
        desc: '5대5 (5선승)',
        group: 'team',
        teamSize: 5,
        killsPerPlayer: 5.5,
      },
      {
        key: 'brawl',
        label: '난투',
        desc: '1대1 · 2대2',
        /* 5대5 전적과 섞으면 둘 다 의미를 잃는다. 따로 센다 */
        group: 'brawl',
        teamSize: 3,
        /* 킬만 주고받는 판이라 인원 대비 킬이 제일 많다 */
        killsPerPlayer: 7.5,
      },
    ],
  },
];

export const DEFAULT_GAME = 'lol';

export const getGame = (key) => GAMES.find((g) => g.key === key) || GAMES[0];

/* ---------- 모드 ---------- */

export const modesOf = (game) => getGame(game).modes;

export const getMode = (game, key) => {
  const list = modesOf(game);
  return list.find((m) => m.key === key) || list[0];
};

export const defaultModeOf = (game) => modesOf(game)[0].key;

/* 이 게임에 실제로 있는 모드인가. 옛 기록('aram')이나 다른 게임의 모드가
   섞여 들어오면 기본 모드로 본다 */
export const hasMode = (game, key) => modesOf(game).some((m) => m.key === key);

/* 집계를 가르는 단위. 5대5끼리는 함께 세고, 난투는 따로 센다.
   1대1 전적과 5대5 전적을 한 표에 올리면 둘 다 읽을 수 없다 */
export const modeGroupOf = (game, key) => getMode(game, key).group;

/* 모드가 하나뿐인 게임은 고르는 칸을 안 그린다 */
export const hasModeChoice = (game) => modesOf(game).length > 1;

export const ALL_GROUPS = 'all';

const GROUP_LABEL = { team: '5대5', brawl: '난투' };

/* 이 게임에 실제로 있는 집계 묶음들. 하나뿐이면 화면이 안 그린다 */
export const modeGroupsOf = (game) => {
  const seen = [];
  modesOf(game).forEach((m) => {
    if (!seen.some((g) => g.key === m.group)) {
      seen.push({ key: m.group, label: GROUP_LABEL[m.group] || m.group });
    }
  });
  return seen;
};

/* ---------- 역할 (롤 라인 · 발로 역할군) ---------- */

export const rolesOf = (game) => getGame(game).roles;
export const roleNamesOf = (game) => getGame(game).roles.map((r) => r.name);
export const getRole = (game, name) => getGame(game).roles.find((r) => r.name === name);

/* ---------- 티어 ---------- */

export const getTier = (game, key) => {
  const list = getGame(game).tiers;
  return list.find((t) => t.key === key) || list[0];
};

/* 그 게임에서 새 사람에게 줄 기본값 */
export const defaultTierOf = (game) => {
  const g = getGame(game);
  return { tier: g.defaultTier, division: g.divisions[0] };
};

/* 디비전의 방향은 게임마다 다르다. 롤은 골드1이 골드4보다 위고,
   발로란트는 브론즈3이 브론즈1보다 위다. 숫자만 보고 뒤집으면 한쪽이
   통째로 거꾸로 매겨진다 - 실제로 발로란트가 그렇게 굴러가고 있었다.

   그래서 숫자를 해석하지 않는다. divisions 배열이 '낮은 칸부터'라는
   규칙 하나만 지키면, 그 안에서 몇 번째냐가 곧 높이다. ratings도
   같은 순서라 자리끼리 맞물린다. */
export const ratingOf = (game, { tier: key, division }) => {
  const t = getTier(game, key);
  if (t.divisions === 0) return t.ratings[0];
  const order = getGame(game).divisions;
  const at = order.indexOf(Number(division));
  /* 그 게임에 없는 칸(발로란트에 디비전 4)이 들어오면 제일 아래로 본다 */
  const idx = at < 0 ? 0 : at;
  return t.ratings[Math.min(t.ratings.length - 1, idx)];
};

export const tierName = (game, { tier: key, division }) => {
  const t = getTier(game, key);
  if (!t.divisions) return t.label;
  /* 그 게임에 없는 칸이 들어오면(발로란트에 디비전 4) 제일 아래 칸으로 읽는다.
     그대로 두면 '골드 4' 같은, 그 게임에 존재하지 않는 이름이 화면에 뜬다 */
  const g = getGame(game);
  const d = g.divisions.includes(Number(division)) ? Number(division) : g.divisions[0];
  return `${t.label} ${d}`;
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
