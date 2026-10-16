/* 전적·정보 페이지의 글자들. 라이엇 API가 주는 영어 키를 화면 말로 바꾼다 */

/* '이름#태그'. 태그를 안 쓰면 한국 기본 태그(KR1)로 본다 */
export const parseRiotId = (text) => {
  const s = String(text || '').trim();
  if (!s) return null;
  const at = s.lastIndexOf('#');
  const name = (at < 0 ? s : s.slice(0, at)).trim();
  const tag = (at < 0 ? 'KR1' : s.slice(at + 1)).trim();
  if (!name || !tag || name.length > 16 || tag.length > 5) return null;
  return { name, tag };
};

export const riotIdText = ({ name, tag }) => `${name}#${tag}`;

/* 자주 보는 큐만. 없는 번호는 게임 모드 이름을 그대로 쓴다 */
const QUEUES = {
  0: '사용자 설정',
  400: '일반',
  420: '솔로 랭크',
  430: '일반',
  440: '자유 랭크',
  450: '칼바람',
  490: '빠른 대전',
  700: '격전',
  900: 'URF',
  1700: '아레나',
  1900: 'URF',
};
export const queueName = (queue, mode) => QUEUES[queue] || mode || '기타';

export const LEAGUE_QUEUES = {
  RANKED_SOLO_5x5: '솔로 랭크',
  RANKED_FLEX_SR: '자유 랭크',
  RANKED_TFT: 'TFT 랭크',
  RANKED_TFT_DOUBLE_UP: 'TFT 더블업',
  RANKED_TFT_TURBO: 'TFT 초고속',
};

const TIERS = {
  IRON: '아이언',
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  EMERALD: '에메랄드',
  DIAMOND: '다이아',
  MASTER: '마스터',
  GRANDMASTER: '그랜드마스터',
  CHALLENGER: '챌린저',
};
/* 마스터 이상은 디비전(I~IV)이 없다 */
export const tierText = (tier, rank) => {
  if (!tier) return '언랭';
  const name = TIERS[tier] || tier;
  return ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? name : `${name} ${rank || ''}`.trim();
};
export const tierName = (tier) => TIERS[tier] || tier || '';

export const CHALLENGE_CATEGORIES = {
  VETERANCY: '베테랑',
  COLLECTION: '수집',
  EXPERTISE: '전문성',
  TEAMWORK: '팀워크',
  IMAGINATION: '상상력',
};

export const TFT_TYPES = { standard: '일반', turbo: '초고속', pairs: '더블업' };

const POSITIONS = { TOP: '탑', JUNGLE: '정글', MIDDLE: '미드', BOTTOM: '원딜', UTILITY: '서폿' };
export const positionName = (pos) => POSITIONS[pos] || '';

const MONSTERS = {
  DRAGON: '용',
  BARON_NASHOR: '바론',
  RIFTHERALD: '전령',
  HORDE: '공허 유충',
  ATAKHAN: '아타칸',
};
const DRAGONS = {
  FIRE_DRAGON: '화염',
  EARTH_DRAGON: '대지',
  WATER_DRAGON: '바다',
  AIR_DRAGON: '바람',
  HEXTECH_DRAGON: '마법공학',
  CHEMTECH_DRAGON: '화학공학',
  ELDER_DRAGON: '장로',
};
export const monsterName = (type, sub) =>
  type === 'DRAGON' && DRAGONS[sub] ? `${DRAGONS[sub]} 용` : MONSTERS[type] || type;

/* 'TFT13_Jinx' → 'Jinx'. 세트 번호 앞머리를 뗀다 */
export const tftName = (id) => String(id || '').replace(/^TFT\d*_?/i, '').replace(/^Set\d+_?/i, '');

/* 초 → 28:04 */
export const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* 데스가 0이면 나눌 수 없다. 'Perfect'로 */
export const kdaRatio = (k, d, a) => (d === 0 ? 'Perfect' : ((k + a) / d).toFixed(2));

export const winRate = (wins, losses) => {
  const n = wins + losses;
  return n === 0 ? null : Math.round((wins / n) * 100);
};

/* 이 키에 권한이 없는 API. 개인 키는 게임마다 따로라(발로란트는 아예 없다)
   롤 키로는 TFT · 발로가 늘 403이다. 늘 실패할 칸은 그리지 않는다 -
   나중에 권한이 생기면 저절로 나타난다 */
export const denied = (part) => part?.error === 401 || part?.error === 403;

/* 서버(api/_riot.js)가 돌려주는 실패 코드 → 화면 말 */
export const errorText = (code) => {
  if (code === 'no_key') return 'API 키가 아직 설정되지 않았어요.';
  if (code === 404) return '찾을 수 없어요.';
  if (code === 401 || code === 403) return '이 API 키로는 볼 수 없는 정보예요.';
  if (code === 429) return '요청이 많아요. 잠시 뒤에 다시 시도해 주세요.';
  if (code === 400 || code === 'bad_name') return '라이엇 ID 형식이 맞지 않아요.';
  return '라이엇 서버가 응답하지 않아요.';
};

/* ---------- 매치 목록 · 상세 ---------- */

/* 매치 목록 탭. key는 서버(api/_riot.js MATCH_FILTERS)와 같아야 한다 */
export const MATCH_TABS = [
  { key: 'all', label: '전체' },
  { key: 'solo', label: '솔로 랭크' },
  { key: 'flex', label: '자유 랭크' },
  { key: 'normal', label: '일반' },
  { key: 'aram', label: '칼바람' },
];

const PUBLIC = process.env.PUBLIC_URL || '';

/* 라이엇 포지션 → public/line_icon (일반 게임 또또가 쓰는 금색 그림) */
const LANE_FILES = {
  TOP: 'top_gold.svg',
  JUNGLE: 'jungle_gold.svg',
  MIDDLE: 'mid_gold.svg',
  BOTTOM: 'adc_gold.webp',
  UTILITY: 'support_gold.svg',
};
export const laneIconOf = (pos) => (LANE_FILES[pos] ? `${PUBLIC}/line_icon/${LANE_FILES[pos]}` : null);

/* 용 종류 → public/dragon_icon. 장로는 그림이 없다 */
const DRAGON_FILES = {
  FIRE_DRAGON: '화염',
  EARTH_DRAGON: '대지',
  WATER_DRAGON: '바다',
  AIR_DRAGON: '바람',
  HEXTECH_DRAGON: '마법공학',
  CHEMTECH_DRAGON: '화학공학',
};
export const dragonIconOf = (sub) =>
  DRAGON_FILES[sub] ? `${PUBLIC}/dragon_icon/${DRAGON_FILES[sub]}.svg` : null;

/* 티어 → public/lol_tier_icon */
export const tierIconOf = (tier) =>
  TIERS[tier] ? `${PUBLIC}/lol_tier_icon/${tier.toLowerCase()}_icon.webp` : null;

const LANE_NAMES = { TOP_LANE: '탑', MID_LANE: '미드', BOT_LANE: '바텀' };
const TOWER_NAMES = {
  OUTER_TURRET: '1차 포탑',
  INNER_TURRET: '2차 포탑',
  BASE_TURRET: '3차 포탑',
  NEXUS_TURRET: '쌍둥이 포탑',
};
/* '미드 2차 포탑' · '바텀 억제기' */
export const buildingName = (building, tower, lane) => {
  const where = LANE_NAMES[lane] || '';
  if (building === 'INHIBITOR_BUILDING') return `${where} 억제기`.trim();
  return tower === 'NEXUS_TURRET' ? TOWER_NAMES[tower] : `${where} ${TOWER_NAMES[tower] || '포탑'}`.trim();
};

/* 밀리초 → 12:04 (타임라인 이벤트) */
export const clockMs = (ms) => clock((ms || 0) / 1000);

/* 2026. 10. 16. (금) 21:12 */
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const dateTimeText = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${WEEK[d.getDay()]}) ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
};

/* 31분 24초 */
export const durationText = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
};

/* 61234 → 61.2k */
export const kilo = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0));
