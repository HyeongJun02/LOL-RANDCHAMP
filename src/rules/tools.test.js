import { TOOLS, READY_TOOLS, SOON_TOOLS, TOOL_SECTIONS } from './tools';

test('모든 도구에 이름·제목·설명·아이콘이 있다', () => {
  TOOLS.forEach((t) => {
    expect(t.name).toBeTruthy();
    expect(t.title).toBeTruthy();
    expect(t.desc).toBeTruthy();
    expect(t.icon).toBeTruthy();
    expect(t.accent).toBeTruthy();
  });
});

test('경로와 이름이 겹치지 않는다', () => {
  const paths = READY_TOOLS.map((t) => t.to);
  expect(new Set(paths).size).toBe(paths.length);
  const names = TOOLS.map((t) => t.name);
  expect(new Set(names).size).toBe(names.length);
});

test('완성된 도구는 반드시 분류가 있다 (홈에서 안 사라지게)', () => {
  READY_TOOLS.forEach((t) => {
    expect(['game', 'scrim']).toContain(t.category);
  });
});

test('분류 섹션이 완성된 도구를 하나도 빠뜨리지 않는다', () => {
  const shown = TOOL_SECTIONS.flatMap((s) => s.tools);
  expect(shown).toHaveLength(READY_TOOLS.length);
  expect(new Set(shown.map((t) => t.to)).size).toBe(READY_TOOLS.length);
});

test('준비 중 도구는 경로가 없다 (눌러도 갈 곳이 없으니)', () => {
  SOON_TOOLS.forEach((t) => expect(t.to).toBeUndefined());
  expect(SOON_TOOLS.length).toBeGreaterThan(0);
});

test('설명이 존댓말로 섞이지 않는다', () => {
  TOOLS.forEach((t) => {
    expect(t.desc).not.toMatch(/(습니다|합니다|하세요|예요|어요)/);
  });
});

/* 홈의 '곁들이 도구'는 내전 방 말고 나머지다. 도구를 하나 더해도
   히어로와 겹치지 않게, 목록을 손으로 적지 않고 걸러 쓴다 */
test('곁들이 도구에는 내전 방이 없다', () => {
  const { SIDE_TOOLS, READY_TOOLS } = require('./tools');
  expect(SIDE_TOOLS.length).toBe(READY_TOOLS.length - 1);
  expect(SIDE_TOOLS.some((t) => t.primary)).toBe(false);
  expect(SIDE_TOOLS.some((t) => t.to === '/rooms')).toBe(false);
});

/* 홈 카드가 작아져서 desc는 길다. 짧은 한 줄을 따로 둔다 */
test('곁들이 도구에는 한 줄 설명이 있다', () => {
  const { SIDE_TOOLS } = require('./tools');
  SIDE_TOOLS.forEach((t) => {
    expect(t.short).toBeTruthy();
    expect(t.short.length).toBeLessThanOrEqual(24);
  });
});
