import {
  GAMES,
  DEFAULT_GAME,
  getGame,
  getTier,
  ratingOf,
  tierName,
  defaultTierOf,
  fitTier,
} from './games';

test('모르는 게임 키는 기본 게임으로 떨어진다', () => {
  expect(getGame('없는게임').key).toBe(DEFAULT_GAME);
  expect(getGame(undefined).key).toBe(DEFAULT_GAME);
});

test('게임마다 티어 사다리가 다르다', () => {
  const lol = getGame('lol').tiers.map((t) => t.key);
  const val = getGame('valorant').tiers.map((t) => t.key);

  expect(lol).toContain('EMERALD');
  expect(lol).toContain('GRANDMASTER');
  expect(val).toContain('ASCENDANT');
  expect(val).toContain('RADIANT');
  /* 발로란트에는 에메랄드가 없다 */
  expect(val).not.toContain('EMERALD');
});

test('디비전 칸 수가 게임마다 다르다 (롤 4칸 · 발로 3칸)', () => {
  expect(getGame('lol').divisions).toEqual([4, 3, 2, 1]);
  expect(getGame('valorant').divisions).toEqual([3, 2, 1]);
});

/* 평점이 뒤집히면 팀 짜기가 거꾸로 돈다. 게임마다 한 번씩 본다 */
GAMES.forEach((g) => {
  test(`${g.short}: 위 티어일수록 평점이 높다`, () => {
    const all = [];
    g.tiers.forEach((t) => {
      /* divisions는 4→1 순서로 적혀 있고, 숫자가 클수록 아래 칸이다 */
      const divs = t.divisions ? g.divisions : [g.divisions[0]];
      divs.forEach((d) => all.push(ratingOf(g.key, { tier: t.key, division: d })));
    });
    expect(all).toEqual([...all].sort((a, b) => a - b));
    /* 같은 값이 겹치면 두 티어가 구분이 안 된다 */
    expect(new Set(all).size).toBe(all.length);
  });

  test(`${g.short}: 제일 낮은 칸이 0점이다`, () => {
    const bottom = g.tiers[0];
    expect(ratingOf(g.key, { tier: bottom.key, division: g.divisions[0] })).toBe(0);
  });

  test(`${g.short}: 기본 티어가 그 게임에 실제로 있는 값이다`, () => {
    const d = defaultTierOf(g.key);
    expect(g.tiers.some((t) => t.key === d.tier)).toBe(true);
    expect(g.divisions).toContain(d.division);
  });
});

test('디비전이 없는 티어는 이름에 숫자를 안 붙인다', () => {
  expect(tierName('lol', { tier: 'GRANDMASTER', division: 1 })).toBe('그랜드마스터');
  expect(tierName('lol', { tier: 'GOLD', division: 2 })).toBe('골드 2');
  expect(tierName('valorant', { tier: 'RADIANT', division: 1 })).toBe('레디언트');
  expect(tierName('valorant', { tier: 'ASCENDANT', division: 3 })).toBe('초월자 3');
});

test('같은 티어 이름이라도 게임이 다르면 평점이 다르다', () => {
  /* 롤 골드는 상위 47%, 발로 골드는 상위 41% 언저리라 자리가 다르다 */
  const lol = ratingOf('lol', { tier: 'GOLD', division: 2 });
  const val = ratingOf('valorant', { tier: 'GOLD', division: 2 });
  expect(lol).not.toBe(val);
});

/* 발로란트 방에 롤 티어(에메랄드)가 들어오면 화면이 빈칸이 된다 */
test('그 게임에 없는 티어는 기본값으로 갈아끼운다', () => {
  expect(fitTier('valorant', { tier: 'EMERALD', division: 2 })).toEqual(
    defaultTierOf('valorant')
  );
  /* 디비전 4는 발로란트에 없다 */
  expect(fitTier('valorant', { tier: 'GOLD', division: 4 })).toEqual({
    tier: 'GOLD',
    division: 3,
  });
  /* 멀쩡한 값은 그대로 둔다 */
  expect(fitTier('lol', { tier: 'DIAMOND', division: 1 })).toEqual({
    tier: 'DIAMOND',
    division: 1,
  });
});

test('없는 티어 키를 물어도 터지지 않는다', () => {
  expect(getTier('valorant', 'EMERALD').key).toBe('IRON');
  expect(ratingOf('valorant', { tier: 'EMERALD', division: 1 })).toBeGreaterThanOrEqual(0);
});
