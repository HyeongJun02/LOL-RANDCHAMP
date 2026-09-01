import { splitTeams, winChance, IGNORE_RATING } from './balance';
import { ratingOf } from '../../tiers';

const p = (name, rating, lock = 0) => ({ name, rating, lock });
const names = (team) => team.map((x) => x.name).sort();

/* rng을 주입해 결과를 고정한다 */
const firstPick = () => 0; // 후보 목록의 첫 번째를 고정 선택

test('평점 합 차이가 최소인 조합으로 나눈다', () => {
  const r = splitTeams(
    [p('a', 10), p('b', 1), p('c', 6), p('d', 5)],
    0,
    firstPick
  );
  expect(r.diff).toBe(0);
  expect(r.sumA).toBe(11);
  expect(r.sumB).toBe(11);
});

test('10명 안 채워도 동작하고, 홀수면 한 명 차이까지 허용', () => {
  const r = splitTeams([p('a', 5), p('b', 5), p('c', 5)], 0, firstPick);
  expect(r.teamA.length + r.teamB.length).toBe(3);
  expect(Math.abs(r.teamA.length - r.teamB.length)).toBe(1);
});

test('2명 미만이면 못 나눈다', () => {
  expect(splitTeams([p('a', 5)], 0)).toBeNull();
});

test('1팀 고정은 반드시 A팀, 2팀 고정은 반드시 B팀', () => {
  const r = splitTeams(
    [p('a', 20, 1), p('b', 20, 2), p('c', 1), p('d', 1)],
    0,
    firstPick
  );
  expect(names(r.teamA)).toContain('a');
  expect(names(r.teamB)).toContain('b');
});

test('고정 조건이 모순이면 null', () => {
  // 4명인데 3명이 1팀 고정 → 2:2로 못 나눔
  const r = splitTeams([p('a', 5, 1), p('b', 5, 1), p('c', 5, 1), p('d', 5)], 0);
  expect(r).toBeNull();
});

test('랜덤성 0이면 항상 최적 조합만 나온다', () => {
  const roster = [p('a', 9), p('b', 8), p('c', 3), p('d', 2)];
  for (let i = 0; i < 50; i += 1) {
    expect(splitTeams(roster, 0).diff).toBe(0);
  }
});

test('랜덤성만큼 평점 오차를 허용하고, 그 범위를 넘지 않는다', () => {
  const roster = [p('a', 9), p('b', 8), p('c', 3), p('d', 2)];
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const r = splitTeams(roster, 4);
    expect(r.diff).toBeLessThanOrEqual(r.bestDiff + 4);
    seen.add(r.diff);
  }
  expect(seen.size).toBeGreaterThan(1); // 실제로 여러 조합이 나온다
});

test('높은 티어일수록 평점이 높다', () => {
  const order = [
    { tier: 'IRON', division: 4 },
    { tier: 'IRON', division: 1 },
    { tier: 'BRONZE', division: 4 },
    { tier: 'GOLD', division: 2 },
    { tier: 'EMERALD', division: 1 },
    { tier: 'DIAMOND', division: 1 },
    { tier: 'MASTER' },
    { tier: 'GRANDMASTER' },
  ].map(ratingOf);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(new Set(order).size).toBe(order.length);
});

test('1팀/2팀만 뒤바뀐 같은 조합은 한 번만 센다', () => {
  // 서로 다른 4명을 2:2로 나누는 방법은 C(4,2)/2 = 3가지
  const r = splitTeams([p('a', 1), p('b', 2), p('c', 4), p('d', 8)], 99, firstPick);
  expect(r.count).toBe(3);
  expect(r.options).toHaveLength(3);
});

test('후보 목록은 평점 차이가 작은 순이고 선택된 조합이 그 안에 있다', () => {
  const r = splitTeams([p('a', 1), p('b', 2), p('c', 4), p('d', 8)], 99);
  const diffs = r.options.map((o) => o.diff);
  expect(diffs).toEqual([...diffs].sort((x, y) => x - y));
  expect(r.options.some((o) => o.id === r.chosenId)).toBe(true);
});

test('각 후보는 참가자를 빠짐없이 한 번씩만 담는다', () => {
  const roster = [p('a', 1), p('b', 2), p('c', 4), p('d', 8), p('e', 3)];
  splitTeams(roster, 99).options.forEach((o) => {
    const all = [...o.teamA, ...o.teamB].map((x) => x.name).sort();
    expect(all).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(o.sumA + o.sumB).toBe(18);
  });
});

describe('재미용 승률', () => {
  const r = (tier, division) => ratingOf({ tier, division });
  const team = (...people) => people.reduce((sum, x) => sum + x, 0);

  test('평점이 같으면 50%', () => {
    expect(winChance(50, 5, 50, 5)).toBe(50);
  });

  test('실력이 같다면 사람이 많은 쪽이 유리하다', () => {
    // 인당 평점은 둘 다 10으로 같다
    expect(winChance(50, 5, 40, 4)).toBeGreaterThan(55);
  });

  test('인원이 같으면 인원 보정이 상쇄되어 평점 차이만 남는다', () => {
    expect(winChance(20, 5, 0, 5)).toBe(winChance(120, 5, 100, 5));
  });

  test('5대5에서 팀 전체가 한 티어 위면 약 66%', () => {
    const gold = r('GOLD', 4) * 5;
    const silver = r('SILVER', 4) * 5;
    expect(winChance(gold, 5, silver, 5)).toBe(66);
  });

  test('같은 한 티어 차이여도 아이언 쪽이 골드 쪽보다 격차가 크다', () => {
    // 랭크 분포상 아이언->브론즈가 골드->플래티넘보다 훨씬 멀다
    const ironVsBronze = winChance(r('BRONZE', 4) * 5, 5, r('IRON', 4) * 5, 5);
    const goldVsPlat = winChance(r('PLATINUM', 4) * 5, 5, r('GOLD', 4) * 5, 5);
    expect(ironVsBronze).toBeGreaterThan(goldVsPlat);
  });

  /* 회귀: 인당 평균으로 비교하던 시절엔 1번 89%, 2번 71%로 뒤집혀 있었다 */
  test('잘하는 한 명보다, 그 한 명에 한 명이 더 붙은 쪽이 세다', () => {
    const gold3 = r('GOLD', 3);
    const iron4 = r('IRON', 4);
    const iron3 = r('IRON', 3);

    const soloGold = winChance(gold3, 1, team(iron4, iron3), 2);
    const goldPlus = winChance(team(gold3, iron4), 2, iron3, 1);

    expect(goldPlus).toBeGreaterThan(soloGold);
    // 골드 하나가 아이언 둘을 상대로도 유리해야 한다
    expect(soloGold).toBeGreaterThan(50);
    expect(goldPlus).toBeGreaterThan(90);
  });

  test('아무리 벌어져도 5~95% 안에 머문다', () => {
    expect(winChance(1000, 5, 0, 5)).toBe(95);
    expect(winChance(0, 5, 1000, 5)).toBe(5);
  });
});

describe('완전 무작위', () => {
  const roster = [p('a', 1), p('b', 2), p('c', 4), p('d', 8), p('e', 16), p('f', 32)];

  test('평점을 무시하지만 인원 수는 맞춘다', () => {
    for (let i = 0; i < 50; i += 1) {
      const r = splitTeams(roster, IGNORE_RATING);
      expect(r.teamA).toHaveLength(3);
      expect(r.teamB).toHaveLength(3);
    }
  });

  test('홀수면 한 명 차이까지만 벌어진다', () => {
    for (let i = 0; i < 50; i += 1) {
      const r = splitTeams(roster.slice(0, 7 - 2), IGNORE_RATING); // 5명
      expect(Math.abs(r.teamA.length - r.teamB.length)).toBe(1);
      expect(r.teamA.length + r.teamB.length).toBe(5);
    }
  });

  test('팀 고정은 무작위여도 지켜진다', () => {
    for (let i = 0; i < 50; i += 1) {
      const r = splitTeams(
        [p('a', 1, 1), p('b', 2, 2), p('c', 4), p('d', 8)],
        IGNORE_RATING
      );
      expect(names(r.teamA)).toContain('a');
      expect(names(r.teamB)).toContain('b');
    }
  });

  test('최적 조합만 나오지 않는다 (실제로 흩어진다)', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      seen.add(splitTeams(roster, IGNORE_RATING).diff);
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});
