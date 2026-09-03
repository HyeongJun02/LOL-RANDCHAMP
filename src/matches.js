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

/* 경기를 시간순으로 훑으면서 그 시점의 예상 승률과 점수 변화를 넘겨준다.
   포인트, 언더독, 연승 저격 계산이 전부 이 한 바퀴를 공유한다. */
const walkGames = (list, mode, visit) => {
  const rating = new Map();
  const get = (n) => rating.get(n) || 0;

  sorted(list, mode).forEach((match) => {
    const teamA = clean(match.teamA);
    const teamB = clean(match.teamB);
    if (teamA.length === 0 || teamB.length === 0) return;

    const avg = (team) => team.reduce((sum, n) => sum + get(n), 0) / team.length;
    const expectedA = 1 / (1 + 10 ** (-(avg(teamA) - avg(teamB)) / ELO_SCALE));
    const aWon = match.winner === 'A';
    const gain = K_FACTOR * ((aWon ? 1 : 0) - expectedA);

    visit({ match, teamA, teamB, aWon, expectedA, gain });

    teamA.forEach((n) => rating.set(n, get(n) + gain));
    teamB.forEach((n) => rating.set(n, get(n) - gain));
  });
};

/* mode 하나만 필터링해 이름별 승/패/포인트를 모은다.
   로스터에 없는 손님 이름도 그냥 문자열로 집계된다. */
export const statsFor = (list, mode) => {
  const stats = new Map();
  const ensure = (name) => {
    if (!stats.has(name)) stats.set(name, { wins: 0, losses: 0, games: 0, raw: 0, points: 0 });
    return stats.get(name);
  };

  walkGames(list, mode, ({ teamA, teamB, aWon, gain }) => {
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

/* ---------- 손으로 세기 힘든 것들 ---------- */

/* 짝 통계는 표본이 적으면 100%/0%가 남발돼서 의미가 없다 */
export const MIN_PAIR_GAMES = 3;

const sorted = (list, mode) =>
  list
    .filter((m) => m.mode === mode)
    .slice()
    .sort((a, b) => (a.playedAt || 0) - (b.playedAt || 0));

const pairKey = (a, b) =>
  JSON.stringify([a, b].sort((x, y) => x.localeCompare(y, 'ko')));

/* 현재 연승/연패와 역대 최고 연승. current는 양수면 연승, 음수면 연패 */
export const streaksOf = (list, mode) => {
  const out = new Map();
  const ensure = (n) => {
    if (!out.has(n)) out.set(n, { current: 0, bestWin: 0, worstLoss: 0 });
    return out.get(n);
  };

  sorted(list, mode).forEach((m) => {
    const teamA = clean(m.teamA);
    const teamB = clean(m.teamB);
    const winners = m.winner === 'A' ? teamA : teamB;
    const losers = m.winner === 'A' ? teamB : teamA;

    winners.forEach((n) => {
      const s = ensure(n);
      s.current = s.current > 0 ? s.current + 1 : 1;
      s.bestWin = Math.max(s.bestWin, s.current);
    });
    losers.forEach((n) => {
      const s = ensure(n);
      s.current = s.current < 0 ? s.current - 1 : -1;
      s.worstLoss = Math.max(s.worstLoss, -s.current);
    });
  });

  return out;
};

/* 같은 팀으로 뛰었을 때의 승률. 궁합 */
export const duosOf = (list, mode, minGames = MIN_PAIR_GAMES) => {
  const pairs = new Map();

  sorted(list, mode).forEach((m) => {
    const teams = [clean(m.teamA), clean(m.teamB)];
    teams.forEach((team, side) => {
      const won = (side === 0) === (m.winner === 'A');
      for (let i = 0; i < team.length; i += 1) {
        for (let j = i + 1; j < team.length; j += 1) {
          const key = pairKey(team[i], team[j]);
          if (!pairs.has(key)) pairs.set(key, { a: team[i], b: team[j], games: 0, wins: 0 });
          const p = pairs.get(key);
          p.games += 1;
          if (won) p.wins += 1;
        }
      }
    });
  });

  return [...pairs.values()]
    .filter((p) => p.games >= minGames)
    .map((p) => ({ ...p, rate: p.wins / p.games }))
    .sort((x, y) => y.rate - x.rate || y.games - x.games);
};

/* 적으로 만났을 때의 상대 전적. 천적 */
export const rivalsOf = (list, mode, minGames = MIN_PAIR_GAMES) => {
  const pairs = new Map();

  sorted(list, mode).forEach((m) => {
    const teamA = clean(m.teamA);
    const teamB = clean(m.teamB);
    const winners = m.winner === 'A' ? teamA : teamB;
    const losers = m.winner === 'A' ? teamB : teamA;

    winners.forEach((w) =>
      losers.forEach((l) => {
        const key = pairKey(w, l);
        if (!pairs.has(key)) {
          /* 이름을 미리 박아둔다. 승자만 기록하면 한쪽이 전승했을 때
             진 사람 이름을 알 방법이 없어진다 */
          const [a, b] = JSON.parse(key);
          pairs.set(key, { a, b, games: 0, aWins: 0 });
        }
        const p = pairs.get(key);
        p.games += 1;
        if (w === p.a) p.aWins += 1;
      })
    );
  });

  return [...pairs.values()]
    .filter((p) => p.games >= minGames)
    .map((p) => {
      const aLeads = p.aWins * 2 >= p.games;
      const wins = aLeads ? p.aWins : p.games - p.aWins;
      return {
        winner: aLeads ? p.a : p.b,
        loser: aLeads ? p.b : p.a,
        games: p.games,
        wins,
        rate: wins / p.games,
      };
    })
    .sort((x, y) => y.rate - x.rate || y.games - x.games);
};

/* 예상 승률이 이보다 낮았는데 이겼으면 '언더독 승리'로 센다 */
export const UNDERDOG_MAX = 0.4;
/* 이만큼 연승 중이던 사람을 잡으면 '연승 저격' */
export const BREAK_MIN = 3;

/* 열세라고 봤는데 이긴 판이 많은 사람 */
export const underdogsOf = (list, mode) => {
  const out = new Map();
  walkGames(list, mode, ({ teamA, teamB, aWon, expectedA }) => {
    const expected = aWon ? expectedA : 1 - expectedA;
    if (expected >= UNDERDOG_MAX) return;
    (aWon ? teamA : teamB).forEach((n) => out.set(n, (out.get(n) || 0) + 1));
  });
  return out;
};

/* 남의 연승을 끊은 횟수. 이긴 팀 전원에게 준다 */
export const streakBreakersOf = (list, mode) => {
  const out = new Map();
  const run = new Map();

  walkGames(list, mode, ({ teamA, teamB, aWon }) => {
    const winners = aWon ? teamA : teamB;
    const losers = aWon ? teamB : teamA;

    if (losers.some((n) => (run.get(n) || 0) >= BREAK_MIN)) {
      winners.forEach((n) => out.set(n, (out.get(n) || 0) + 1));
    }
    winners.forEach((n) => run.set(n, (run.get(n) || 0) + 1));
    losers.forEach((n) => run.set(n, 0));
  });

  return out;
};

/* 하루에 가장 많이 몰아친 날 */
export const busiestDayOf = (list, mode) => {
  const byDay = new Map();
  list
    .filter((m) => m.mode === mode)
    .forEach((m) => {
      const d = new Date(m.playedAt || 0);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      byDay.set(key, (byDay.get(key) || 0) + 1);
    });

  const [top] = [...byDay.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
  return top ? { day: top[0], games: top[1] } : null;
};

/* 이름별 마지막 출전 시각 */
export const lastSeenOf = (list, mode) => {
  const out = new Map();
  list
    .filter((m) => m.mode === mode)
    .forEach((m) => {
      [...(m.teamA || []), ...(m.teamB || [])].forEach((name) => {
        const key = String(name).trim();
        if (!key) return;
        out.set(key, Math.max(out.get(key) || 0, m.playedAt || 0));
      });
    });
  return out;
};
