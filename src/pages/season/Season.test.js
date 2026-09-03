import { monthKeyOf, monthsOf, inMonth, monthLabel } from '../../matches';

const at = (y, m, d) => new Date(y, m - 1, d, 21, 0).getTime();

test('로컬 시각 기준으로 YYYY-MM을 만든다', () => {
  expect(monthKeyOf(at(2026, 9, 3))).toBe('2026-09');
  expect(monthKeyOf(at(2026, 12, 31))).toBe('2026-12');
});

test('기록이 있는 달만 최신순으로 준다', () => {
  const list = [
    { playedAt: at(2026, 8, 5) },
    { playedAt: at(2026, 10, 1) },
    { playedAt: at(2026, 8, 20) },
  ];
  expect(monthsOf(list)).toEqual(['2026-10', '2026-08']);
});

test('달을 넘나드는 기록이 섞이지 않는다', () => {
  const list = [
    { id: 'a', playedAt: at(2026, 9, 30) },
    { id: 'b', playedAt: at(2026, 10, 1) },
  ];
  expect(inMonth(list, '2026-09').map((m) => m.id)).toEqual(['a']);
  expect(inMonth(list, '2026-10').map((m) => m.id)).toEqual(['b']);
});

test('기록이 없으면 빈 배열', () => {
  expect(monthsOf([])).toEqual([]);
});

test('라벨은 0을 떼고 보여준다', () => {
  expect(monthLabel('2026-09')).toBe('2026년 9월');
  expect(monthLabel('2026-12')).toBe('2026년 12월');
});
