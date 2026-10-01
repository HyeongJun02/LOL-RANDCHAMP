import {
  CASUAL_KILL_LINES,
  FIRST_BLOOD_LANE_SHARE,
  FIRST_DRAGON_ODDS,
  FIRST_BLOOD_RATE,
  KILLS_ODDS,
} from './tuning';

/* 일반 게임 또또.

   내전이 아니라 우리끼리 일반·칼바람 큐를 돌릴 때 거는 또또다. 전적에는
   안 들어간다 - 상대가 누군지 모르고 팀을 짠 것도 아니라서 승패를 남겨봐야
   의미가 없다. 끼꼬만 오간다.

   그래서 내전과 마켓이 다르다.
     승리팀   없음 (우리 다섯이 한 팀이라 '어느 팀'이 없다)
     총 킬    언더/오버 - 기준선이 모드마다 다르다
     킬 짝홀  반반
     첫 킬    우리팀/상대팀 중 하나, 또는 우리 중 누구 하나
     첫 용    여섯 종류 중 하나 (칼바람에는 용이 없다) */

export const CASUAL_MODES = [
  { key: 'normal', label: '일반', desc: '소환사의 협곡' },
  { key: 'aram', label: '칼바람', desc: '무작위 총력전' },
];

export const CASUAL_TEAM_SIZE = 5;

/* 칼바람은 라인이 없다. 용도 없다 */
export const hasLanes = (mode) => mode !== 'aram';
export const hasDragon = (mode) => mode !== 'aram';

export const LANES = [
  { key: 'TOP', label: '탑' },
  { key: 'JUNGLE', label: '정글' },
  { key: 'MID', label: '미드' },
  { key: 'ADC', label: '원딜' },
  { key: 'SUPPORT', label: '서폿' },
];

/* public/dragon_icon 의 파일들. 첫 용은 장로가 될 수 없어서 여섯뿐이다 */
export const DRAGONS = [
  { key: 'infernal', label: '화염', icon: '화염' },
  { key: 'mountain', label: '대지', icon: '대지' },
  { key: 'ocean', label: '바다', icon: '바다' },
  { key: 'cloud', label: '바람', icon: '바람' },
  { key: 'hextech', label: '마법공학', icon: '마법공학' },
  { key: 'chemtech', label: '화학공학', icon: '화학공학' },
];

export const dragonIcon = (key) => {
  const d = DRAGONS.find((x) => x.key === key);
  return d ? `${process.env.PUBLIC_URL || ''}/dragon_icon/${d.icon}.svg` : null;
};

export const dragonLabel = (key) => DRAGONS.find((x) => x.key === key)?.label || '?';

export const laneLabel = (key) => LANES.find((x) => x.key === key)?.label || '';

/* 모드별 기본 기준선. 방장이 직접 고쳐 열 수 있다 */
export const casualKillLine = (mode) =>
  CASUAL_KILL_LINES[mode] ?? CASUAL_KILL_LINES.normal;

/* 첫 킬을 이 라인이 딸 배당.

   상대팀이 딸 확률 절반을 먼저 떼고, 남은 절반을 라인 몫으로 가른다.
   칼바람은 라인이 없으니 다섯이 똑같이 나눈다. */
export const firstBloodOdds = (lane, mode) => {
  const share = hasLanes(mode)
    ? FIRST_BLOOD_LANE_SHARE[lane] ?? 1 / CASUAL_TEAM_SIZE
    : 1 / CASUAL_TEAM_SIZE;
  if (!(share > 0)) return null;
  return Math.round((FIRST_BLOOD_RATE / (0.5 * share)) * 100) / 100;
};

/* 반반인 마켓(짝홀·우리팀/상대팀)은 언더오버와 같은 기준 배당을 쓴다 */
export const evenOdds = () => KILLS_ODDS;

/* 일반 게임 또또에 열리는 마켓. 모드에 따라 다르다 */
export const casualMarkets = (mode, line) => [
  { key: `kills_${line}`, label: `총 킬 ${line}`, kind: 'kills' },
  { key: 'kills_parity', label: '킬 짝/홀', kind: 'parity' },
  { key: 'fb_side', label: '첫 킬 - 어느 팀', kind: 'side' },
  { key: 'first_blood', label: '첫 킬 - 누구', kind: 'person' },
  ...(hasDragon(mode) ? [{ key: 'dragon', label: '첫 용', kind: 'dragon' }] : []),
];

/* 정산이 끝난 뒤 이 마켓의 정답.
   결과를 안 넣은 마켓은 null이고, 그러면 전액 환불된다 (내전과 같다) */
export const casualAnswer = (scrim, market) => {
  if (!scrim || scrim.status !== 'settled') return null;
  if (market === 'kills_parity') {
    if (scrim.total_kills == null) return null;
    return scrim.total_kills % 2 === 0 ? 'even' : 'odd';
  }
  if (market === 'fb_side') return scrim.fb_side ?? null;
  if (market === 'dragon') return scrim.first_dragon ?? null;
  return null;
};

export const PARITY = [
  { key: 'odd', label: '홀' },
  { key: 'even', label: '짝' },
];

export const SIDES = [
  { key: 'us', label: '우리 팀' },
  { key: 'them', label: '상대 팀' },
];
