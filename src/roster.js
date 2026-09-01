import { useSyncExternalStore } from 'react';

/* 저장된 팀원 명단. 백엔드가 없으니 localStorage에 둔다.
   모듈 하나가 소유하고 useSyncExternalStore로 뿌려서, 어느 페이지에서 고쳐도
   열려 있는 모든 화면이 같은 값을 본다. 다른 탭 변경도 storage 이벤트로 따라온다. */
const KEY = 'lrc.roster';

const uid = () => Math.random().toString(36).slice(2, 9);

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(raw)) return [];
    /* id 없던 옛 데이터도 그대로 살린다 */
    return raw.map((m) => ({
      tier: 'GOLD',
      division: 4,
      lines: [],
      ...m,
      id: m.id || uid(),
    }));
  } catch {
    return [];
  }
};

let roster = read();
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

const commit = (next) => {
  roster = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(roster));
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
  roster = read();
  notify();
});

export const useRoster = () => useSyncExternalStore(subscribe, () => roster);

export const addMember = (member = {}) =>
  commit([...roster, { id: uid(), name: '', tier: 'GOLD', division: 4, lines: [], ...member }]);

export const updateMember = (id, patch) =>
  commit(roster.map((m) => (m.id === id ? { ...m, ...patch } : m)));

export const removeMember = (id) => commit(roster.filter((m) => m.id !== id));

/* 이름이 같으면 티어만 갱신, 없으면 추가. 저장된 인원 수를 돌려준다 */
export const mergeMembers = (people) => {
  const next = [...roster];
  people.forEach(({ name, tier, division }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const at = next.findIndex((m) => m.name === trimmed);
    if (at >= 0) next[at] = { ...next[at], tier, division };
    else next.push({ id: uid(), name: trimmed, tier, division });
  });
  const added = next.length - roster.length;
  commit(next);
  return added;
};
