import { statsFor, statOf, pointsOf } from '../../matches';

/* 배지 툴팁이 실제 계산값과 어긋나지 않는지 본다.
   (렌더 없이, 툴팁에 들어갈 재료가 맞는지) */
const list = [
  { id: 'a', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
  { id: 'b', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 2 },
  { id: 'c', mode: 'normal', teamA: ['영희'], teamB: ['철수'], winner: 'A', playedAt: 3 },
];

test('툴팁 재료(판수·승·패·누적)가 전부 들어 있다', () => {
  const stats = statsFor(list, 'normal');
  const s = statOf(stats, '철수');

  expect(s).toMatchObject({ games: 3, wins: 2, losses: 1 });
  expect(typeof s.raw).toBe('number');
  expect(s.points).toBe(pointsOf(stats, '철수'));
});

test('보정 전(raw)과 보정 후(points)는 같은 부호이고, 보정 후가 절댓값이 작다', () => {
  const s = statOf(statsFor(list, 'normal'), '철수');
  expect(Math.sign(s.points)).toBe(Math.sign(s.raw));
  expect(Math.abs(s.points)).toBeLessThanOrEqual(Math.abs(s.raw));
});

test('기록 없는 사람은 null을 준다 (툴팁 없이 표시)', () => {
  expect(statOf(statsFor(list, 'normal'), '없는사람')).toBeNull();
  expect(statOf(statsFor(list, 'normal'), '  철수  ')).not.toBeNull();
});
