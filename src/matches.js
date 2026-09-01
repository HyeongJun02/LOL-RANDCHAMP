import { useSyncExternalStore } from 'react';

/* 내전 전적. roster.js와 같은 패턴 — localStorage 하나를 모듈이 소유하고
   useSyncExternalStore로 뿌린다. 다른 탭 변경도 storage 이벤트로 따라온다. */
const KEY = 'lrc.matches';

const uid = () => Math.random().toString(36).slice(2, 9);

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

let matches = read();
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

const commit = (next) => {
  matches = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(matches));
  } catch {
    /* 사파리 프라이빗 모드 등. 이번 세션에서만 유지된다 */
  }
  notify();
};

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  matches = read();
  notify();
});

export const useMatches = () => useSyncExternalStore(subscribe, () => matches);

/**
 * @param mode 'aram' | 'normal'
 * @param teamA, teamB 이름 배열 (공백 제거된 상태로 넘길 것)
 * @param winner 'A' | 'B'
 */
export const addMatch = ({ mode, teamA, teamB, winner }) =>
  commit([
    ...matches,
    { id: uid(), mode, teamA, teamB, winner, playedAt: Date.now() },
  ]);

export const removeMatch = (id) => commit(matches.filter((m) => m.id !== id));

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
