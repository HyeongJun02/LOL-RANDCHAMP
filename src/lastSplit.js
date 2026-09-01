/* 내전 팀 짜기에서 만든 팀 구성을 내전 기록지로 넘기기 위한 임시 보관함.
   실시간 구독이 필요 없는 단발성 전달이라 roster.js와 달리
   useSyncExternalStore 없이 읽기/쓰기 함수만 둔다. */
const KEY = 'lrc.lastSplit';

export const saveLastSplit = (teamA, teamB) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ teamA, teamB, at: Date.now() }));
  } catch {
    /* 사파리 프라이빗 모드 등. 이번 세션에서만 넘기지 못할 뿐 치명적이지 않다 */
  }
};

export const loadLastSplit = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || !Array.isArray(raw.teamA) || !Array.isArray(raw.teamB)) return null;
    return raw;
  } catch {
    return null;
  }
};
