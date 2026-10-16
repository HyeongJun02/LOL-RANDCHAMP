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

/* 서버(api/_riot.js)가 돌려주는 실패 코드 → 화면 말 */
export const errorText = (code) => {
  if (code === 'no_key') return 'API 키가 아직 설정되지 않았어요.';
  if (code === 404) return '찾을 수 없어요.';
  if (code === 401 || code === 403) return '이 API 키로는 볼 수 없는 정보예요.';
  if (code === 429) return '요청이 많아요. 잠시 뒤에 다시 시도해 주세요.';
  if (code === 400 || code === 'bad_name') return '라이엇 ID 형식이 맞지 않아요.';
  return '라이엇 서버가 응답하지 않아요.';
};
