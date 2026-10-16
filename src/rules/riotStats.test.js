import { contribution, mvpOf, matchInsights, summarize } from './riotStats';

/* 열 명짜리 판을 짧게 만든다. over: puuid별로 덮어쓸 값 */
const match = ({ over = {}, duration = 1800, blueWin = true, kills = [20, 10] } = {}) => {
  const base = (puuid, team, pos) => ({
    puuid,
    name: puuid,
    tag: 'KR1',
    team,
    win: team === 100 ? blueWin : !blueWin,
    champ: 'Ahri',
    pos,
    k: 2,
    d: 2,
    a: 2,
    cs: 150,
    gold: 10000,
    dmg: 10000,
    vision: 20,
    multi: 1,
    ...(over[puuid] || {}),
  });
  const pos = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
  return {
    id: 'KR_1',
    duration,
    players: [
      ...pos.map((p, i) => base(`B${i}`, 100, p)),
      ...pos.map((p, i) => base(`R${i}`, 200, p)),
    ],
    teams: [
      { id: 100, win: blueWin, kills: kills[0] },
      { id: 200, win: !blueWin, kills: kills[1] },
    ],
  };
};

test('기여 점수: 다 같이 하면 중간, 혼자 다 하면 10에 가깝다', () => {
  const even = match();
  /* 킬 관여 4/20 = 0.2 → 0.08, 비중 0.2 → 반 점수씩 0.3 */
  expect(contribution(even, even.players[0])).toBe(3.8);

  const carry = match({ over: { B0: { k: 15, a: 5, dmg: 60000, gold: 20000, vision: 60 } } });
  expect(contribution(carry, carry.players[0])).toBeGreaterThanOrEqual(9.5);
});

test('MVP는 이긴 팀 1등, ACE는 진 팀 1등. 다시하기는 없다', () => {
  const m = match({ over: { B2: { k: 10, dmg: 30000 }, R4: { a: 8, vision: 70 } } });
  expect(mvpOf(m)).toEqual({ mvp: 'B2', ace: 'R4' });
  expect(mvpOf(match({ duration: 200 }))).toEqual({ mvp: null, ace: null });
});

test('한 판 요약: 역전승 · 15분 골드 · 처음 가져간 것 · 피해 비중', () => {
  const m = match({ blueWin: false, over: { R0: { dmg: 40000 } } });
  const gold = Array.from({ length: 25 }, (_, i) => (i < 18 ? i * 200 : 3400 - (i - 17) * 900));
  const tl = {
    goldDiff: gold,
    events: [
      { kind: 'kill', team: 100 },
      { kind: 'monster', monster: 'DRAGON', team: 200 },
      { kind: 'building', building: 'TOWER_BUILDING', team: 100 },
    ],
  };
  const texts = matchInsights(m, tl, 'R0').map((x) => x.text);
  expect(texts[0]).toBe('레드팀이 최대 3,400 골드 뒤졌다가 역전승');
  expect(texts).toContain('15분 골드 블루팀 +3,000');
  expect(texts).toContain('블루팀 첫 킬 · 첫 포탑 / 레드팀 첫 용');
  expect(texts).toContain('R0(나)가 팀 피해의 50%');
});

test('최근 판들: 연승 · 평균 · 챔피언 · 같이 한 사람, 다시하기는 뺀다', () => {
  const me = 'B0';
  const games = [
    match({ over: { B0: { champ: 'Ahri', k: 10, d: 0 } } }),
    match({ over: { B0: { champ: 'Ahri' } } }),
    match({ blueWin: false, over: { B0: { champ: 'Zed' } } }),
    match({ duration: 120 }),
  ];
  const s = summarize(games, me);
  expect(s.games).toBe(3);
  expect(s.wins).toBe(2);
  expect(s.streak).toEqual({ win: true, count: 2 });
  expect(s.champs.map((c) => [c.key, c.games, c.wins])).toEqual([
    ['Ahri', 2, 2],
    ['Zed', 1, 0],
  ]);
  /* 같은 팀 네 명과 세 판 다 같이 했다 */
  expect(s.mates).toHaveLength(4);
  expect(s.mates[0]).toMatchObject({ games: 3, wins: 2 });
  expect(s.avg.kp).toBe(Math.round(((12 / 20 + 4 / 20 + 4 / 20) / 3) * 100));
  expect(summarize([], me)).toBeNull();
});
