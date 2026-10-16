import { tftStage, tftQueueName, TFT_TABS, placeTone, unitCost, summarizeTft } from './tft';

test('라운드 번호 → 단계-라운드', () => {
  expect(tftStage(1)).toBe('1-1');
  expect(tftStage(4)).toBe('1-4');
  expect(tftStage(5)).toBe('2-1');
  expect(tftStage(11)).toBe('2-7');
  expect(tftStage(12)).toBe('3-1');
  expect(tftStage(33)).toBe('6-1');
  expect(tftStage(null)).toBe('');
});

test('큐 이름과 탭 거르기', () => {
  expect(tftQueueName({ queue: 1100 })).toBe('랭크');
  expect(tftQueueName({ queue: 99999, type: 'pairs' })).toBe('더블업');
  const pairs = TFT_TABS.find((t) => t.key === 'pairs');
  expect(pairs.test({ queue: 1160 })).toBe(true);
  expect(pairs.test({ queue: 1100, type: 'standard' })).toBe(false);
});

test('등수 색 · 코스트', () => {
  expect([1, 3, 6].map(placeTone)).toEqual(['is-first', 'is-top', 'is-bottom']);
  expect(unitCost({ cost: 6 })).toBe(5);
  expect(unitCost({ cost: 0 }, 2)).toBe(2);
});

test('최근 판 분석: 평균 등수 · 순방 · 1등 · 주 특성 · 많이 쓴 유닛', () => {
  const p = (placement, traits, units) => ({
    players: [
      {
        puuid: 'me',
        placement,
        level: 8,
        damage: 100,
        traits: traits.map(([name, style]) => ({ name, style })),
        units: units.map((id) => ({ id })),
      },
    ],
  });
  const s = summarizeTft(
    [
      p(1, [['A', 3], ['B', 1]], ['X', 'Y']),
      p(5, [['A', 4]], ['X']),
      p(3, [['C', 3]], ['Y', 'Y']),
    ],
    'me'
  );
  expect(s.games).toBe(3);
  expect(s.avgPlace).toBe(3);
  expect(s.top4).toBe(2);
  expect(s.wins).toBe(1);
  expect(s.recent).toEqual([1, 5, 3]);
  /* B는 동(1)이라 주 특성이 아니다 */
  expect(s.traits.map((t) => [t.key, t.games, t.avgPlace])).toEqual([
    ['A', 2, 3],
    ['C', 1, 3],
  ]);
  /* 한 판에 같은 유닛 둘은 한 번으로 */
  expect(s.units.find((u) => u.key === 'Y').games).toBe(2);
  expect(summarizeTft([], 'me')).toBeNull();
});
