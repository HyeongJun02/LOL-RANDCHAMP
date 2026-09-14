import { useMemo } from 'react';
import { createStore } from './store';
import { DEFAULT_GAME, defaultTierOf } from './games';

/* 저장된 팀원 명단. localStorage가 기본이고, 로그인하면 Neon과 동기화된다.
   저장 방식은 store.js가 전부 맡고 여기는 명단 규칙만 갖는다.

   게임마다 명단이 따로다. 롤 친구와 발로 친구가 다르고, 같은 사람이라도
   티어 체계가 달라서 한 줄에 못 담는다. 표를 나누는 대신 사람마다
   game을 달아두고 걸러 쓴다 - 한 배열이라 저장·동기화 코드가 그대로다. */
const uid = () => Math.random().toString(36).slice(2, 9);

/* id 없던 옛 데이터, lines 없던 데이터도 그대로 살린다.
   game이 없던 시절 데이터는 전부 롤이다 */
const hydrate = (list) =>
  list.map((m) => ({
    game: DEFAULT_GAME,
    tier: 'GOLD',
    division: 4,
    lines: [],
    ...m,
    id: m.id || uid(),
  }));

/* 로그인 시 합치기: 같은 게임에서 이름이 같으면 한 사람으로 보고 서버 쪽을
   남긴다. 이 기기에만 있던 사람은 뒤에 붙는다 — 어느 쪽도 버리지 않는다 */
const keyOf = (m) => `${m.game || DEFAULT_GAME}:${m.name.trim()}`;

const merge = (local, remote) => {
  const out = [...remote];
  const seen = new Set(remote.map(keyOf));
  local.forEach((m) => {
    if (!m.name.trim()) return;
    if (seen.has(keyOf(m))) return;
    seen.add(keyOf(m));
    out.push(m);
  });
  return out;
};

const store = createStore({
  key: 'lrc.roster',
  column: 'roster',
  hydrate,
  merge,
  limitKind: 'roster',
});

/* 게임 하나의 명단만. 화면은 늘 한 게임만 본다 */
export const useRoster = (game = DEFAULT_GAME) => {
  const all = store.use();
  return useMemo(() => all.filter((m) => (m.game || DEFAULT_GAME) === game), [all, game]);
};

/* 모든 게임을 한 번에 봐야 할 때 (설정 화면의 개수 표시 등) */
export const useAllRoster = store.use;

/* React 밖에서 지금 값을 읽어야 할 때 */
export const getRoster = (game) =>
  game ? store.get().filter((m) => (m.game || DEFAULT_GAME) === game) : store.get();

export const addMember = (game = DEFAULT_GAME, member = {}) =>
  store.commit([
    ...store.get(),
    { id: uid(), game, name: '', lines: [], ...defaultTierOf(game), ...member },
  ]);

export const updateMember = (id, patch) =>
  store.commit(store.get().map((m) => (m.id === id ? { ...m, ...patch } : m)));

export const removeMember = (id) =>
  store.commit(store.get().filter((m) => m.id !== id));

/* 이름이 같으면 티어만 갱신, 없으면 추가. 저장된 인원 수를 돌려준다.
   같은 이름이라도 게임이 다르면 다른 사람이다 */
export const mergeMembers = (game, people) => {
  const roster = store.get();
  const next = [...roster];
  people.forEach(({ name, tier, division }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const at = next.findIndex(
      (m) => (m.game || DEFAULT_GAME) === game && m.name === trimmed
    );
    if (at >= 0) next[at] = { ...next[at], tier, division };
    else next.push({ id: uid(), game, name: trimmed, tier, division });
  });
  const added = next.length - roster.length;
  store.commit(next);
  return added;
};
