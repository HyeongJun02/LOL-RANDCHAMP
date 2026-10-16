/* 라이엇 API가 준 숫자로 우리가 새로 셈하는 기록들.
   공식 점수가 아니라 우리가 정한 식이다 - 식은 여기 한 곳에만 둔다.
   매치 모양은 api/_riot.js의 slimMatch · slimTimeline */

/* 다시하기(리메이크)는 셈에서 뺀다. 5분 안에 끝난 판 */
export const REMAKE_SEC = 300;
export const isRemake = (m) => (m?.duration || 0) < REMAKE_SEC;

const teamOf = (m, team) => m.players.filter((p) => p.team === team);
const share = (v, total) => (total > 0 ? (v || 0) / total : 0);

/* 기여 점수 0~10. 킬 관여 40% · 팀 내 피해 비중 30% · 골드 비중 20% · 시야 비중 10%.
   다섯 명이 똑같이 했으면 비중이 각 0.2라, 비중 항목은 0.4(평균의 2배)를 만점으로 본다 */
export const CONTRIB_WEIGHTS = { kp: 0.4, dmg: 0.3, gold: 0.2, vision: 0.1 };

export const contribution = (m, p) => {
  const mates = teamOf(m, p.team);
  const sum = (f) => mates.reduce((s, x) => s + (x[f] || 0), 0);
  const kills = m.teams.find((t) => t.id === p.team)?.kills || 0;
  const kp = kills ? Math.min(1, ((p.k || 0) + (p.a || 0)) / kills) : 0;
  const capped = (v) => Math.min(1, v / 0.4);
  const score =
    CONTRIB_WEIGHTS.kp * kp +
    CONTRIB_WEIGHTS.dmg * capped(share(p.dmg, sum('dmg'))) +
    CONTRIB_WEIGHTS.gold * capped(share(p.gold, sum('gold'))) +
    CONTRIB_WEIGHTS.vision * capped(share(p.vision, sum('vision')));
  return Math.round(score * 100) / 10;
};

/* 이긴 팀 1등이 MVP, 진 팀 1등이 ACE. 다시하기는 없다 */
export const mvpOf = (m) => {
  if (!m || isRemake(m)) return { mvp: null, ace: null };
  const best = (win) =>
    m.players
      .filter((p) => p.win === win)
      .map((p) => ({ p, s: contribution(m, p) }))
      .sort((a, b) => b.s - a.s)[0]?.p.puuid || null;
  return { mvp: best(true), ace: best(false) };
};

/* ---------- 한 판 요약 (타임라인까지 보고) ---------- */

const TEAM = { 100: '블루팀', 200: '레드팀' };

/* 사람이 읽을 문장 몇 줄. 순서는 '판의 흐름 → 오브젝트 → 사람' */
export const matchInsights = (m, tl, me) => {
  if (!m || isRemake(m)) return [];
  const out = [];
  const winner = m.teams.find((t) => t.win)?.id;
  const gold = tl?.goldDiff || [];

  /* 역전: 이긴 팀이 한때 가장 크게 뒤졌던 골드 */
  if (winner && gold.length) {
    const sign = winner === 100 ? 1 : -1;
    const worst = Math.min(...gold.map((g) => g * sign));
    if (worst <= -2000) {
      out.push({ kind: 'comeback', text: `${TEAM[winner]}이 최대 ${(-worst).toLocaleString()} 골드 뒤졌다가 역전승` });
    }
    const best = Math.max(...gold.map((g) => Math.abs(g)));
    const at = gold.findIndex((g) => Math.abs(g) === best);
    if (best >= 1000 && worst > -2000) {
      out.push({
        kind: 'lead',
        text: `${at}분에 가장 크게 벌어졌다 - ${gold[at] > 0 ? '블루팀' : '레드팀'} +${best.toLocaleString()} 골드`,
      });
    }
  }
  if (gold.length > 15) {
    const g = gold[15];
    out.push({
      kind: 'g15',
      text: g === 0 ? '15분 골드 동률' : `15분 골드 ${g > 0 ? '블루팀' : '레드팀'} +${Math.abs(g).toLocaleString()}`,
    });
  }

  /* 처음 가져간 것들 */
  const ev = tl?.events || [];
  const first = (pred) => ev.find(pred)?.team;
  const firsts = [
    ['첫 킬', first((e) => e.kind === 'kill')],
    ['첫 용', first((e) => e.kind === 'monster' && e.monster === 'DRAGON')],
    ['첫 포탑', first((e) => e.kind === 'building' && e.building === 'TOWER_BUILDING')],
  ].filter(([, t]) => t);
  if (firsts.length) {
    const byTeam = (t) => firsts.filter(([, x]) => x === t).map(([n]) => n);
    const parts = [100, 200]
      .map((t) => (byTeam(t).length ? `${TEAM[t]} ${byTeam(t).join(' · ')}` : null))
      .filter(Boolean);
    out.push({ kind: 'firsts', text: parts.join(' / ') });
  }

  /* 피해를 제일 많이 책임진 사람 (팀 내 비중) */
  const carry = m.players
    .map((p) => ({ p, s: share(p.dmg, teamOf(m, p.team).reduce((s, x) => s + (x.dmg || 0), 0)) }))
    .sort((a, b) => b.s - a.s)[0];
  if (carry && carry.s >= 0.3) {
    out.push({
      kind: 'carry',
      text: `${carry.p.name || '?'}${carry.p.puuid === me ? '(나)' : ''}가 팀 피해의 ${Math.round(carry.s * 100)}%`,
    });
  }
  return out;
};

/* ---------- 최근 판들 분석 ---------- */

const POS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

/* matches: slimMatch 배열 (최신이 앞). me: puuid */
export const summarize = (matches, me) => {
  const games = matches
    .filter((m) => m && !isRemake(m))
    .map((m) => ({ m, p: m.players.find((x) => x.puuid === me) }))
    .filter((x) => x.p);
  const n = games.length;
  if (!n) return null;

  const wins = games.filter((g) => g.p.win).length;
  const sum = (f) => games.reduce((s, g) => s + f(g), 0);
  const minutes = sum((g) => g.m.duration / 60) || 1;

  /* 연승 · 연패: 가장 최근 판부터 같은 결과가 몇 번 이어졌나 */
  let streak = 0;
  for (const g of games) {
    if (g.p.win !== games[0].p.win) break;
    streak += 1;
  }

  const k = sum((g) => g.p.k || 0);
  const d = sum((g) => g.p.d || 0);
  const a = sum((g) => g.p.a || 0);
  const kp = sum((g) => {
    const kills = g.m.teams.find((t) => t.id === g.p.team)?.kills || 0;
    return kills ? ((g.p.k || 0) + (g.p.a || 0)) / kills : 0;
  });

  const group = (keyOf) => {
    const map = new Map();
    games.forEach((g) => {
      const key = keyOf(g);
      if (!key) return;
      const cur = map.get(key) || { key, games: 0, wins: 0, k: 0, d: 0, a: 0 };
      cur.games += 1;
      cur.wins += g.p.win ? 1 : 0;
      cur.k += g.p.k || 0;
      cur.d += g.p.d || 0;
      cur.a += g.p.a || 0;
      map.set(key, cur);
    });
    return [...map.values()].sort((x, y) => y.games - x.games || y.wins - x.wins);
  };

  /* 같은 팀으로 두 번 이상 만난 사람. 이름#태그로 묶는다 */
  const mates = new Map();
  games.forEach((g) => {
    g.m.players
      .filter((x) => x.team === g.p.team && x.puuid !== me && x.name)
      .forEach((x) => {
        const id = `${x.name}#${x.tag}`;
        const cur = mates.get(id) || { id, name: x.name, tag: x.tag, games: 0, wins: 0 };
        cur.games += 1;
        cur.wins += g.p.win ? 1 : 0;
        mates.set(id, cur);
      });
  });

  return {
    games: n,
    wins,
    rate: Math.round((wins / n) * 100),
    streak: { win: games[0].p.win, count: streak },
    avg: {
      k: k / n,
      d: d / n,
      a: a / n,
      kda: d === 0 ? null : (k + a) / d,
      csPerMin: sum((g) => g.p.cs || 0) / minutes,
      dmgPerMin: sum((g) => g.p.dmg || 0) / minutes,
      visionPerMin: sum((g) => g.p.vision || 0) / minutes,
      kp: Math.round((kp / n) * 100),
    },
    mvp: games.filter((g) => mvpOf(g.m).mvp === me).length,
    ace: games.filter((g) => mvpOf(g.m).ace === me).length,
    multi: {
      triple: games.filter((g) => g.p.multi === 3).length,
      quadra: games.filter((g) => g.p.multi === 4).length,
      penta: games.filter((g) => g.p.multi >= 5).length,
    },
    champs: group((g) => g.p.champ),
    lanes: group((g) => (POS.includes(g.p.pos) ? g.p.pos : null)),
    mates: [...mates.values()]
      .filter((x) => x.games >= 2)
      .sort((x, y) => y.games - x.games || y.wins - x.wins),
  };
};
