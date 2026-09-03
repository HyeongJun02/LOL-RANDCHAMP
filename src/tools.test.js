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
