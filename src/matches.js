import { createStore } from './store';

/* 내전 전적. localStorage가 기본이고, 로그인하면 Neon과 동기화된다.
   저장 방식은 store.js가 맡고 여기는 전적 규칙과 집계만 갖는다. */
const uid = () => Math.random().toString(36).slice(2, 9);

/* 로그인 시 합치기: 같은 경기(id)는 한 번만. 기기마다 기록한 경기가
   전부 살아남고, 시간순으로 다시 정렬한다 */
const merge = (local, remote) => {
  const byId = new Map();
  [...remote, ...local].forEach((m) => {
    if (m && m.id && !byId.has(m.id)) byId.set(m.id, m);
  });
  return [...byId.values()].sort((a, b) => (a.playedAt || 0) - (b.playedAt || 0));
};

const store = createStore({ key: 'lrc.matches', column: 'matches', merge });

export const useMatches = store.use;

/**
 * @param mode 'aram' | 'normal'
 * @param teamA, teamB 이름 배열 (공백 제거된 상태로 넘길 것)
 * @param winner 'A' | 'B'
 */
export const addMatch = ({ mode, teamA, teamB, winner }) =>
  store.commit([
    ...store.get(),
    { id: uid(), mode, teamA, teamB, winner, playedAt: Date.now() },
  ]);

export const removeMatch = (id) =>
  store.commit(store.get().filter((m) => m.id !== id));

/* 승 1회 = +WIN, 패 1회 = +LOSS(음수). tiers.js 평점 눈금(티어 하나가 대략 6~7점,
   디비전 하나가 1~2점)에 맞춰 승 1회를 디비전 하나 정도로 잡았다. */
export const POINTS = { WIN: 2, LOSS: -2 };

/* mode 하나만 필터링해 이름별 승/패/포인트를 모은다. 인원 변동 있는 내전도
   그냥 이름 문자열로 집계하므로 로스터에 없는 손님 이름도 잡힌다. */
export const statsFor = (list, mode) => {
  const stats = new Map();

  const bump = (name, field, delta) => {
    const key = name.trim();
    if (!key) return;
    if (!stats.has(key)) stats.set(key, { wins: 0, losses: 0, points: 0 });
    const s = stats.get(key);
    s[field] += 1;
    s.points += delta;
  };

  list
    .filter((m) => m.mode === mode)
    .forEach((m) => {
      const winners = m.winner === 'A' ? m.teamA : m.teamB;
      const losers = m.winner === 'A' ? m.teamB : m.teamA;
      winners.forEach((name) => bump(name, 'wins', POINTS.WIN));
      losers.forEach((name) => bump(name, 'losses', POINTS.LOSS));
    });

  return stats;
};

export const pointsOf = (stats, name) => stats.get(String(name).trim())?.points || 0;
