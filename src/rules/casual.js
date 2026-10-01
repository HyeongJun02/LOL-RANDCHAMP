import {
  PARLAY_MAX_WIN,
  CASUAL_KILL_LINES,
  FIRST_BLOOD_LANE_SHARE,
  FIRST_DRAGON_ODDS,
  CASUAL_FB_RATE,
  CASUAL_FB_TIER_BONUS,
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

/* 아이콘은 라인 정하기가 쓰는 금색 그림 (public/line_icon) */
export const LANES = [
  { key: 'TOP', label: '탑', icon: 'top_gold.svg' },
  { key: 'JUNGLE', label: '정글', icon: 'jungle_gold.svg' },
  { key: 'MID', label: '미드', icon: 'mid_gold.svg' },
  { key: 'ADC', label: '원딜', icon: 'adc_gold.webp' },
  { key: 'SUPPORT', label: '서폿', icon: 'support_gold.svg' },
];

export const laneIcon = (key) => {
  const l = LANES.find((x) => x.key === key);
  return l ? `${process.env.PUBLIC_URL || ''}/line_icon/${l.icon}` : null;
};

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

/* 우리 팀·상대 팀 킬 기준선. 총 기준선의 절반을 .5로 맞춘다 (29.5 → 14.5).
   sql/setup.sql의 team_kill_line과 같아야 한다 */
export const teamKillLine = (total) => Math.floor(Number(total) / 2) + 0.5;

/* 킬 언더오버 셋. 셋 중 하나만 건다 - 우리 팀 오버와 총 오버는 거의 같이
   움직여서, 둘 다 걸면 같은 걸 두 번 거는 셈이다 */
export const killTrio = (total) => {
  const t = teamKillLine(total);
  return [
    { key: `ourkills_${t}`, label: '우리 팀', line: t },
    { key: `kills_${total}`, label: '총 킬', line: Number(total) },
    { key: `oppkills_${t}`, label: '상대 팀', line: t },
  ];
};

export const isKillTrio = (market) =>
  /^(ourkills|oppkills)_/.test(market) ||
  (market.startsWith('kills_') && market !== 'kills_parity');

/* 상대 팀 첫 킬은 사람을 모르니 라인으로 건다 ('them_TOP') */
export const enemyPick = (lane) => `them_${lane}`;
export const enemyLaneOf = (sel) =>
  typeof sel === 'string' && sel.startsWith('them_') ? sel.slice(5) : null;

/* 첫 킬 표의 줄 순서. 탑 · 정글 · 미드 · 서폿 · 원딜 */
export const FB_ROW_ORDER = ['TOP', 'JUNGLE', 'MID', 'SUPPORT', 'ADC'];

/* 우리 다섯을 첫 킬 표의 줄에 앉힌다. 라인이 있으면 그 줄에, 미정이면
   남은 줄에 차례대로. 칼바람은 라인이 없으니 고른 순서대로 */
export const fbRows = (ids, lanes = {}, mode) => {
  const rows = FB_ROW_ORDER.map((lane) => ({ lane, id: null }));
  if (!hasLanes(mode)) {
    ids.forEach((id, i) => {
      if (rows[i]) rows[i].id = id;
    });
    return rows;
  }
  const rest = [];
  ids.forEach((id) => {
    const row = rows.find((r) => r.lane === lanes[id] && r.id == null);
    if (row) row.id = id;
    else rest.push(id);
  });
  rest.forEach((id) => {
    const row = rows.find((r) => r.id == null);
    if (row) row.id = id;
  });
  return rows;
};

/* 묶음 배팅의 거는 상한. 버는 끼꼬가 PARLAY_MAX_WIN을 넘지 않게.
   sql/setup.sql의 place_parlay와 같은 셈이다 */
export const parlayCap = (odds) => (odds > 1 ? Math.floor(PARLAY_MAX_WIN / (odds - 1)) : 0);

/* 담은 배팅들의 묶음 배당. 서버처럼 곱한 뒤에 한 번만 반올림한다 */
export const parlayOdds = (legOdds) => {
  if (legOdds.length < 2 || legOdds.some((o) => !(o > 0))) return null;
  return Math.round(legOdds.reduce((a, b) => a * b, 1) * 100) / 100;
};

/* 첫 킬을 이 라인이 딸 배당.

   상대팀이 딸 확률 절반을 먼저 떼고, 남은 절반을 라인 몫으로 가른다.
   칼바람은 라인이 없으니 다섯이 똑같이 나눈다. */
/* 롤 티어 사다리에서 골드(3)보다 몇 칸 아래인가. 모르는 티어는 골드로 본다.
   sql/setup.sql의 tier_ladder('lol')과 같은 순서다 */
const LOL_LADDER = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER',
];
export const tierFactor = (tier) => {
  const idx = LOL_LADDER.indexOf(tier);
  return 1 + (3 - (idx < 0 ? 3 : idx)) * CASUAL_FB_TIER_BONUS;
};

/* tier는 우리 쪽 사람에게만 준다. 상대 라인은 티어를 모른다 */
export const firstBloodOdds = (lane, mode, tier) => {
  const share = hasLanes(mode)
    ? FIRST_BLOOD_LANE_SHARE[enemyLaneOf(lane) || lane] ?? 1 / CASUAL_TEAM_SIZE
    : 1 / CASUAL_TEAM_SIZE;
  if (!(share > 0)) return null;
  return Math.round(((CASUAL_FB_RATE / (0.5 * share)) * tierFactor(tier)) * 100) / 100;
};

/* 반반인 마켓(짝홀·우리팀/상대팀)은 언더오버와 같은 기준 배당을 쓴다 */
export const evenOdds = () => KILLS_ODDS;

/* 첫 용 배당. 고정이라 마감 전에도 그대로 보여준다 */
export const dragonOdds = () => FIRST_DRAGON_ODDS;

/* 일반 게임 또또에 열리는 마켓. 모드에 따라 다르다 */
export const casualMarkets = (mode, line) => [
  { key: `kills_${line}`, label: `총 킬 ${line}`, kind: 'kills' },
  { key: 'kills_parity', label: '킬 짝/홀', kind: 'parity' },
  { key: 'fb_side', label: '첫 킬 - 어느 팀', kind: 'side' },
  { key: 'first_blood', label: '첫 킬 - 누구', kind: 'person' },
  ...(hasDragon(mode) ? [{ key: 'dragon', label: '첫 용', kind: 'dragon' }] : []),
];

/* 정산이 끝난 뒤 이 마켓의 정답. 일반 게임 또또의 마켓 전부를 여기서
   판단한다 - 화면 세 곳(선택지 색, 내 배팅, 참여자 목록)이 같은 기준을
   봐야 한다.
   결과를 안 넣은 마켓은 null이고, 그러면 전액 환불된다 (내전과 같다) */
export const casualAnswer = (scrim, market) => {
  if (!scrim || scrim.status !== 'settled') return null;

  if (market === 'kills_parity') {
    if (scrim.total_kills == null) return null;
    return scrim.total_kills % 2 === 0 ? 'even' : 'odd';
  }
  /* 'kills_parity'가 아래 가지에 먼저 걸리면 'parity'를 숫자로 읽어
     NaN과 비교하게 된다. 순서가 중요하다 */
  if (market.startsWith('kills_')) {
    if (scrim.total_kills == null) return null;
    return scrim.total_kills > Number(market.split('_')[1]) ? 'over' : 'under';
  }
  if (/^(ourkills|oppkills)_/.test(market)) {
    const v = market.startsWith('our') ? scrim.our_kills : scrim.opp_kills;
    if (v == null) return null;
    return v > Number(market.split('_')[1]) ? 'over' : 'under';
  }
  if (market === 'fb_side') return scrim.fb_side ?? null;
  if (market === 'dragon') return scrim.first_dragon ?? null;

  /* 첫 킬 - 누구.
     상대가 땄으면 우리 쪽에 건 사람은 전부 낙첨이다. 환불이 아니다 -
     배당(8.5배 언저리)이 이미 '상대가 딸 확률 절반'을 값에 넣고 있어서,
     상대가 땄을 때 돌려주면 걸기만 해도 이득인 마켓이 된다.
     아무 선택지와도 안 맞는 값을 돌려줘서 전부 낙첨으로 그린다 */
  if (market === 'first_blood') {
    if (!scrim.fb_side) return null;
    if (scrim.fb_side === 'them') {
      return scrim.fb_enemy_lane ? enemyPick(scrim.fb_enemy_lane) : 'them';
    }
    return scrim.first_blood_player_id == null
      ? null
      : String(scrim.first_blood_player_id);
  }
  return null;
};

/* 정산이 끝난 판에서 이 선택이 어떻게 됐나. 'win' · 'lose' · 'void'(환불).
   sql/setup.sql의 leg_result와 같은 규칙이다.

   정답 하나로는 말할 수 없는 경우가 하나 있다 - 상대가 첫 킬을 땄는데
   어느 라인인지 모를 때. 상대 라인에 건 것은 돌려주고, 우리 쪽 사람에
   건 것은 그대로 낙첨이다 */
export const casualOutcome = (scrim, market, selection) => {
  if (!scrim || scrim.status !== 'settled') return null;
  if (
    market === 'first_blood' &&
    scrim.fb_side === 'them' &&
    !scrim.fb_enemy_lane &&
    enemyLaneOf(selection)
  ) {
    return 'void';
  }
  const ans = casualAnswer(scrim, market);
  if (ans == null) return 'void';
  return ans === selection ? 'win' : 'lose';
};

export const PARITY = [
  { key: 'odd', label: '홀' },
  { key: 'even', label: '짝' },
];

export const SIDES = [
  { key: 'us', label: '우리 팀' },
  { key: 'them', label: '상대 팀' },
];
