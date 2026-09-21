import { PICK_GROUPS, PICK_META, picksOf, inAnyPick } from './champPicks';

test('그룹마다 이름·설명·챔피언이 채워져 있다', () => {
  expect(PICK_GROUPS.length).toBeGreaterThan(0);
  PICK_GROUPS.forEach((g) => {
    expect(g.key).toMatch(/^[a-z]+$/);
    expect(g.label).toBeTruthy();
    expect(g.desc).toBeTruthy();
    expect(g.champions.length).toBeGreaterThan(0);
  });
});

test('그룹 키가 서로 겹치지 않는다', () => {
  const keys = PICK_GROUPS.map((g) => g.key);
  expect(new Set(keys).size).toBe(keys.length);
});

/* 손으로 적는 배열이라 같은 챔피언을 두 번 쓰면 조용히 중복된다 */
test('한 그룹 안에 같은 챔피언이 두 번 들어가지 않는다', () => {
  PICK_GROUPS.forEach((g) => {
    expect(new Set(g.champions).size).toBe(g.champions.length);
  });
});

test('한 챔피언이 여러 그룹에 속할 수 있다', () => {
  // 자크는 변칙 서폿이면서 AP 정글
  expect(picksOf('Zac').sort()).toEqual(['apjungle', 'oddsup']);
});

test('그룹에 없는 챔피언은 빈 배열이지 에러가 아니다', () => {
  expect(picksOf('없는챔피언')).toEqual([]);
});

test('inAnyPick은 여러 그룹을 OR로 본다', () => {
  expect(inAnyPick('Camille', ['oddsup'])).toBe(true);
  expect(inAnyPick('Camille', ['apjungle'])).toBe(false);
  expect(inAnyPick('Camille', ['apjungle', 'oddsup'])).toBe(true);
  expect(inAnyPick('Camille', [])).toBe(false);
});

test('없는 그룹 키를 넘겨도 죽지 않는다', () => {
  expect(inAnyPick('Camille', ['그런그룹없음'])).toBe(false);
});

test('출처와 갱신일이 비어 있지 않다', () => {
  expect(PICK_META.author).toBeTruthy();
  expect(PICK_META.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(PICK_META.note).toBeTruthy();
});
