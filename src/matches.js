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

/* ------------------------------------------------------------------
   내전 포인트

   그냥 승 +2 / 패 -2로 세면 누구와 붙었는지가 통째로 무시된다.
   아이언 팀을 이긴 다이아와 다이아 팀을 이긴 아이언이 같은 점수를 받고,
   판수만 많이 채워도 점수가 오른다.

   그래서 Elo 방식으로 센다. 경기를 시간순으로 훑으면서, 그 시점의 양 팀
   평균 포인트로 예상 승률을 구하고 '예상보다 잘한 만큼'만 준다.
     변화량 = K × (실제결과 − 예상승률)
   이길 게 뻔했던 승리는 거의 안 오르고, 질 것 같던 팀이 이기면 크게 오른다.

   여기에 판수 보정을 얹는다. 2판 2승이 100판 60승보다 위로 가면 곤란하니,
   판수가 적으면 결과를 0쪽으로 끌어당긴다(베이지안 스무딩).
     표시점수 = 누적 × 판수 / (판수 + PRIOR_GAMES)
   ------------------------------------------------------------------ */

/* 한 판으로 움직일 수 있는 최대 점수.
   체스 Elo가 K/SCALE ≈ 8%인 걸 참고해 3으로 잡았다. 이보다 크면
   한 판 결과에 순위가 출렁이고, 작으면 판수가 쌓여도 잘 안 갈린다. */
export const K_FACTOR = 3;
/* 포인트 차이를 승률로 바꾸는 축척. tiers.js 눈금과 같은 크기로 맞췄다 */
export const ELO_SCALE = 14;
/* 판수가 이만큼 쌓여야 결과를 절반쯤 믿는다 */
export const PRIOR_GAMES = 3;

const clean = (names) => [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];

/* mode 하나만 필터링해 이름별 승/패/포인트를 모은다.
   로스터에 없는 손님 이름도 그냥 문자열로 집계된다. */
export const statsFor = (list, mode) => {
  const stats = new Map();
  const ensure = (name) => {
    if (!stats.has(name)) stats.set(name, { wins: 0, losses: 0, games: 0, raw: 0, points: 0 });
    return stats.get(name);
  };

  list
    .filter((m) => m.mode === mode)
    .slice()
    .sort((a, b) => (a.playedAt || 0) - (b.playedAt || 0))
    .forEach((m) => {
      const teamA = clean(m.teamA);
      const teamB = clean(m.teamB);
      if (teamA.length === 0 || teamB.length === 0) return;

      const avg = (team) => team.reduce((sum, n) => sum + ensure(n).raw, 0) / team.length;
      const expectedA = 1 / (1 + 10 ** (-(avg(teamA) - avg(teamB)) / ELO_SCALE));
      const aWon = m.winner === 'A';
      /* A가 얻는 만큼 B가 잃는다 */
      const gain = K_FACTOR * ((aWon ? 1 : 0) - expectedA);

      const apply = (team, delta, won) =>
        team.forEach((name) => {
          const s = ensure(name);
          s.raw += delta;
          s.games += 1;
          s[won ? 'wins' : 'losses'] += 1;
        });

      apply(teamA, gain, aWon);
      apply(teamB, -gain, !aWon);
    });

  /* 판수가 적으면 0쪽으로 당긴다 */
  stats.forEach((s) => {
    s.points = Math.round(((s.raw * s.games) / (s.games + PRIOR_GAMES)) * 10) / 10;
  });

  return stats;
};

/* 배지 툴팁에서 '어떻게 이 점수가 나왔는지' 풀어주려면 항목 전체가 필요하다 */
export const statOf = (stats, name) => stats.get(String(name).trim()) || null;

export const pointsOf = (stats, name) => stats.get(String(name).trim())?.points || 0;

/* 이름별 내전 참여 횟수. 모드 구분 없이 전부 센다.
   명단을 '많이 같이 한 순'으로 정렬할 때 쓴다 */
export const gameCountsOf = (list) => {
  const counts = new Map();
  list.forEach((m) => {
    [...(m.teamA || []), ...(m.teamB || [])].forEach((name) => {
      const key = String(name).trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return counts;
};

/* ---------- 월별 정산 ---------- */

/* 'YYYY-MM'. 로컬 시각 기준 (내전은 우리 동네 밤에 한다) */
export const monthKeyOf = (playedAt) => {
  const d = new Date(playedAt || 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* 기록이 있는 달만, 최신 순으로 */
export const monthsOf = (list) =>
  [...new Set(list.map((m) => monthKeyOf(m.playedAt)))].sort().reverse();

export const inMonth = (list, monthKey) =>
  list.filter((m) => monthKeyOf(m.playedAt) === monthKey);

export const monthLabel = (monthKey) => {
  const [y, m] = String(monthKey).split('-');
  return `${y}년 ${Number(m)}월`;
};
