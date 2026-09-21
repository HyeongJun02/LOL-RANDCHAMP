import {
  GAMES,
  DEFAULT_GAME,
  getGame,
  getTier,
  ratingOf,
  tierName,
  defaultTierOf,
  fitTier,
  getMode,
  hasMode,
  hasModeChoice,
  modeGroupOf,
  modeGroupsOf,
  rolesOf,
  roleNamesOf,
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

/* 칸 수만 다른 게 아니라 방향도 반대다. 롤은 1이 제일 위,
   발로란트는 3이 제일 위. 배열은 둘 다 '낮은 칸부터'로 적는다 */
test('디비전 칸 수와 방향이 게임마다 다르다 (롤 4칸 · 발로 3칸)', () => {
  expect(getGame('lol').divisions).toEqual([4, 3, 2, 1]);
  expect(getGame('valorant').divisions).toEqual([1, 2, 3]);
});

/* 평점이 뒤집히면 팀 짜기가 거꾸로 돈다. 게임마다 한 번씩 본다 */
GAMES.forEach((g) => {
  test(`${g.label}: 위 티어일수록 평점이 높다`, () => {
    const all = [];
    g.tiers.forEach((t) => {
      /* divisions는 게임과 무관하게 '낮은 칸부터' 적혀 있다 */
      const divs = t.divisions ? g.divisions : [g.divisions[0]];
      divs.forEach((d) => all.push(ratingOf(g.key, { tier: t.key, division: d })));
    });
    expect(all).toEqual([...all].sort((a, b) => a - b));
    /* 같은 값이 겹치면 두 티어가 구분이 안 된다 */
    expect(new Set(all).size).toBe(all.length);
  });

  test(`${g.label}: 제일 낮은 칸이 0점이다`, () => {
    const bottom = g.tiers[0];
    expect(ratingOf(g.key, { tier: bottom.key, division: g.divisions[0] })).toBe(0);
  });

  test(`${g.label}: 기본 티어가 그 게임에 실제로 있는 값이다`, () => {
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
  /* 디비전 4는 발로란트에 없다. 제일 낮은 칸(골드1)으로 내려간다 */
  expect(fitTier('valorant', { tier: 'GOLD', division: 4 })).toEqual({
    tier: 'GOLD',
    division: 1,
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

/* ---------- 모드 ---------- */

test('롤은 모드가 하나뿐이라 고르는 칸을 안 그린다', () => {
  expect(hasModeChoice('lol')).toBe(false);
  expect(hasModeChoice('valorant')).toBe(true);
});

test('발로란트 난투는 1대1·2대2라 팀 칸이 5가 아니다', () => {
  expect(getMode('valorant', 'brawl').teamSize).toBe(2);
  expect(getMode('valorant', 'standard').teamSize).toBe(5);
});

/* 난투 전적이 5대5 전적에 섞이면 둘 다 못 읽는다 */
test('난투는 5대5와 다른 묶음으로 센다', () => {
  expect(modeGroupOf('valorant', 'brawl')).toBe('brawl');
  expect(modeGroupOf('valorant', 'standard')).toBe('team');
  expect(modeGroupOf('valorant', 'swift')).toBe('team');
  expect(modeGroupOf('lol', 'normal')).toBe('team');
});

test('묶음 목록은 게임에 실제로 있는 것만 준다', () => {
  expect(modeGroupsOf('lol').map((g) => g.key)).toEqual(['team']);
  expect(modeGroupsOf('valorant').map((g) => g.key)).toEqual(['team', 'brawl']);
});

test('모르는 모드는 그 게임의 첫 모드로 떨어진다 (옛 aram 기록 등)', () => {
  expect(getMode('lol', 'aram').key).toBe('normal');
  expect(getMode('valorant', undefined).key).toBe('standard');
  expect(hasMode('lol', 'brawl')).toBe(false);
  expect(hasMode('valorant', 'brawl')).toBe(true);
});

test('모드마다 한 판에 나오는 킬이 다르다', () => {
  const per = (g, m) => getMode(g, m).killsPerPlayer;
  /* 난투 > 롤 내전 > 발로 일반 > 발로 신속 */
  expect(per('valorant', 'brawl')).toBeGreaterThan(per('lol', 'normal'));
  expect(per('lol', 'normal')).toBeGreaterThan(per('valorant', 'standard'));
  expect(per('valorant', 'standard')).toBeGreaterThan(per('valorant', 'swift'));
});

/* ---------- 역할 (롤 라인 · 발로 역할군) ---------- */

test('게임마다 역할이 다르다', () => {
  expect(roleNamesOf('lol')).toEqual(['탑', '정글', '미드', '원딜', '서폿']);
  expect(roleNamesOf('valorant')).toEqual(['타격대', '척후대', '감시자', '전략가']);
});

test('롤은 한 명씩 다른 라인, 발로란트는 겹쳐도 된다', () => {
  /* 롤은 다섯 자리를 다섯 명이 나눠 갖는다 */
  expect(getGame('lol').uniqueRoles).toBe(true);
  expect(roleNamesOf('lol')).toHaveLength(5);
  /* 발로란트는 역할이 넷인데 팀이 다섯이라 겹칠 수밖에 없다 */
  expect(getGame('valorant').uniqueRoles).toBe(false);
  expect(roleNamesOf('valorant')).toHaveLength(4);
});

test('역할마다 색과 그릴 것이 있다', () => {
  ['lol', 'valorant'].forEach((g) => {
    rolesOf(g).forEach((r) => {
      expect(r.color).toMatch(/^#/);
      /* 롤은 아이콘 파일, 발로는 이모지 */
      expect(r.icon || r.emoji).toBeTruthy();
      expect(r.quotes.length).toBeGreaterThan(0);
    });
  });
});

/* 게임 이름을 줄여 쓰면 사람마다 다르게 읽는다 ('롤'·'옵치'·'발로'…) */
test('게임은 풀네임 하나로만 부른다', () => {
  GAMES.forEach((g) => {
    expect(g.short).toBeUndefined();
    expect(g.label.length).toBeGreaterThan(2);
  });
  expect(getGame('lol').label).toBe('리그 오브 레전드');
  expect(getGame('valorant').label).toBe('발로란트');
});

test('게임마다 로고와 색이 있다', () => {
  GAMES.forEach((g) => {
    expect(g.logo).toMatch(/^\/logo\//);
    expect(g.color).toMatch(/^#/);
  });
});

/* 발로란트 역할 아이콘은 단색 SVG라 마스크로 색을 입힌다.
   mono 표시가 빠지면 넷이 다 같은 흰색으로 보인다 */
test('발로란트 역할 아이콘은 색을 입힐 수 있게 표시돼 있다', () => {
  rolesOf('valorant').forEach((r) => {
    expect(r.mono).toBe(true);
    expect(r.icon).toMatch(/^\/val_role_icon\//);
  });
  /* 롤 아이콘은 이미 칠해진 그림이라 그대로 쓴다 */
  rolesOf('lol').forEach((r) => expect(r.mono).toBeUndefined());
});

/* 롤은 골드1이 골드4보다 위고, 발로란트는 브론즈3이 브론즈1보다 위다.
   숫자만 보고 뒤집으면 한쪽이 통째로 거꾸로 매겨진다 */
describe('디비전 방향은 게임마다 다르다', () => {
  test('롤은 숫자가 작을수록 높다', () => {
    const hi = ratingOf('lol', { tier: 'GOLD', division: 1 });
    const lo = ratingOf('lol', { tier: 'GOLD', division: 4 });
    expect(hi).toBeGreaterThan(lo);
  });

  test('발로란트는 숫자가 클수록 높다', () => {
    const hi = ratingOf('valorant', { tier: 'BRONZE', division: 3 });
    const lo = ratingOf('valorant', { tier: 'BRONZE', division: 1 });
    expect(hi).toBeGreaterThan(lo);
  });

  test('두 게임 모두 divisions 배열이 낮은 칸부터다', () => {
    ['lol', 'valorant'].forEach((key) => {
      const g = getGame(key);
      const ratings = g.divisions.map((d) => ratingOf(key, { tier: 'GOLD', division: d }));
      const sorted = [...ratings].sort((a, b) => a - b);
      expect(ratings).toEqual(sorted);
    });
  });

  /* 새로 들어온 사람은 그 티어의 제일 아래 칸에서 시작한다 */
  test('기본값은 제일 낮은 칸이다', () => {
    ['lol', 'valorant'].forEach((key) => {
      const d = defaultTierOf(key);
      const mine = ratingOf(key, d);
      getGame(key).divisions.forEach((div) => {
        expect(mine).toBeLessThanOrEqual(ratingOf(key, { tier: d.tier, division: div }));
      });
    });
  });

  /* 그 게임에 없는 칸이 들어와도 화면이 깨지면 안 된다 */
  test('발로란트에 디비전 4가 들어오면 제일 아래로 본다', () => {
    expect(ratingOf('valorant', { tier: 'BRONZE', division: 4 })).toBe(
      ratingOf('valorant', { tier: 'BRONZE', division: 1 })
    );
    expect(tierName('valorant', { tier: 'BRONZE', division: 4 })).toBe('브론즈 1');
  });
});
