import { createStore } from './store';

/* 저장된 팀원 명단. localStorage가 기본이고, 로그인하면 Neon과 동기화된다.
   저장 방식은 store.js가 전부 맡고 여기는 명단 규칙만 갖는다. */
const uid = () => Math.random().toString(36).slice(2, 9);

/* id 없던 옛 데이터, lines 없던 데이터도 그대로 살린다 */
const hydrate = (list) =>
  list.map((m) => ({
    tier: 'GOLD',
    division: 4,
    lines: [],
    ...m,
    id: m.id || uid(),
  }));

/* 로그인 시 합치기: 같은 이름이면 한 사람으로 보고 서버 쪽을 남긴다.
   이 기기에만 있던 사람은 뒤에 붙는다 — 어느 쪽도 버리지 않는다 */
const merge = (local, remote) => {
  const out = [...remote];
  const seen = new Set(remote.map((m) => m.name.trim()));
  local.forEach((m) => {
    const name = m.name.trim();
    if (name && seen.has(name)) return;
    if (name) seen.add(name);
    out.push(m);
  });
  return out;
};

const store = createStore({ key: 'lrc.roster', column: 'roster', hydrate, merge });

export const useRoster = store.use;

export const addMember = (member = {}) =>
  store.commit([
    ...store.get(),
    { id: uid(), name: '', tier: 'GOLD', division: 4, lines: [], ...member },
  ]);

export const updateMember = (id, patch) =>
  store.commit(store.get().map((m) => (m.id === id ? { ...m, ...patch } : m)));

export const removeMember = (id) =>
  store.commit(store.get().filter((m) => m.id !== id));

/* 이름이 같으면 티어만 갱신, 없으면 추가. 저장된 인원 수를 돌려준다 */
export const mergeMembers = (people) => {
  const roster = store.get();
  const next = [...roster];
  people.forEach(({ name, tier, division }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const at = next.findIndex((m) => m.name === trimmed);
    if (at >= 0) next[at] = { ...next[at], tier, division };
    else next.push({ id: uid(), name: trimmed, tier, division });
  });
  const added = next.length - roster.length;
  store.commit(next);
  return added;
};
