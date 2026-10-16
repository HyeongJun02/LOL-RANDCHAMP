/* TFT 전적의 글자 · 계산. 매치 모양은 api/_riot.js의 slimTftMatch */

/* 큐 번호 (라이엇 queues 기준). 모르는 번호는 게임 종류(tft_game_type)로 */
const QUEUES = {
  1090: '일반',
  1100: '랭크',
  1130: '초고속',
  1160: '더블업',
  1210: '초고속',
  6000: '이벤트',
};
const TYPES = { standard: '일반', turbo: '초고속', pairs: '더블업' };
export const tftQueueName = (m) => QUEUES[m?.queue] || TYPES[m?.type] || 'TFT';

/* 큐 탭. 라이엇이 TFT 목록은 큐로 걸러 주지 않아서 받아 둔 판에서 거른다 */
export const TFT_TABS = [
  { key: 'all', label: '전체', test: () => true },
  { key: 'ranked', label: '랭크', test: (m) => m.queue === 1100 },
  { key: 'normal', label: '일반', test: (m) => m.queue === 1090 },
  { key: 'turbo', label: '초고속', test: (m) => m.type === 'turbo' || m.queue === 1130 },
  { key: 'pairs', label: '더블업', test: (m) => m.type === 'pairs' || m.queue === 1160 },
];

/* 라운드 번호 → '5-3'. 1단계는 네 라운드(1-1 ~ 1-4), 그다음부터 단계마다 일곱 */
export const tftStage = (round) => {
  if (!round) return '';
  if (round <= 4) return `1-${round}`;
  const r = round - 5;
  return `${Math.floor(r / 7) + 2}-${(r % 7) + 1}`;
};

/* 등수 색: 1등 · 순방(2~4) · 그 밖 */
export const placeTone = (p) => (p === 1 ? 'is-first' : p <= 4 ? 'is-top' : 'is-bottom');

/* API의 rarity(0 · 1 · 2 · 4 · 6)를 코스트(1~5)로. 데이터 드래곤 코스트가 있으면 그쪽이 먼저 */
const RARITY_COST = { 0: 1, 1: 2, 2: 3, 4: 4, 6: 5 };
export const unitCost = (unit, fromData) => fromData || RARITY_COST[unit?.cost] || null;

/* 'TFT16_Tristana' → 'Tristana' (데이터 드래곤에 이름이 없을 때) */
export const tftShortName = (id) => String(id || '').replace(/^TFT\d*_?/i, '').replace(/^Set\d+_?/i, '');

/* 최근 판들. matches는 최신이 앞 */
export const summarizeTft = (matches, me) => {
  const games = matches
    .filter(Boolean)
    .map((m) => ({ m, p: m.players.find((x) => x.puuid === me) }))
    .filter((x) => x.p);
  const n = games.length;
  if (!n) return null;

  const places = games.map((g) => g.p.placement);
  const avg = (f) => games.reduce((s, g) => s + (f(g) || 0), 0) / n;

  /* 같은 특성 · 유닛을 쓴 판끼리 묶어 평균 등수 */
  const tally = (keysOf) => {
    const map = new Map();
    games.forEach((g) => {
      new Set(keysOf(g.p)).forEach((key) => {
        const cur = map.get(key) || { key, games: 0, placeSum: 0, top4: 0 };
        cur.games += 1;
        cur.placeSum += g.p.placement;
        cur.top4 += g.p.placement <= 4 ? 1 : 0;
        map.set(key, cur);
      });
    });
    return [...map.values()]
      .map((x) => ({ ...x, avgPlace: x.placeSum / x.games }))
      .sort((a, b) => b.games - a.games || a.avgPlace - b.avgPlace);
  };

  return {
    games: n,
    avgPlace: places.reduce((a, b) => a + b, 0) / n,
    top4: places.filter((p) => p <= 4).length,
    wins: places.filter((p) => p === 1).length,
    avgLevel: avg((g) => g.p.level),
    avgDamage: avg((g) => g.p.damage),
    /* 최근 몇 판 등수 (최신이 앞) - 흐름을 한눈에 */
    recent: places.slice(0, 10),
    /* 금 이상(style 3+)으로 켠 특성만 '주 특성'으로 센다 */
    traits: tally((p) => p.traits.filter((t) => t.style >= 3).map((t) => t.name)),
    units: tally((p) => p.units.map((u) => u.id)),
  };
};
