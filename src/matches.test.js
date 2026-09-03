import * as store from './matches';

/* 전적은 이제 방(rooms.js)이 들고 있고, 이 파일은 계산만 한다.
   저장/불러오기 테스트는 rooms.test.js로 옮겼다 */

describe('statsFor', () => {
  test('이긴 팀은 승 +1, 진 팀은 패 +1', () => {
    const list = [
      { mode: 'normal', teamA: ['철수', '영희'], teamB: ['민수', '지훈'], winner: 'A' },
    ];
    const stats = store.statsFor(list, 'normal');
    expect(stats.get('철수')).toMatchObject({ wins: 1, losses: 0, games: 1 });
    expect(stats.get('민수')).toMatchObject({ wins: 0, losses: 1, games: 1 });
    expect(stats.get('철수').points).toBe(-stats.get('민수').points);
  });

  test('다른 모드는 섞이지 않는다', () => {
    const list = [
      { mode: 'aram', teamA: ['철수'], teamB: ['영희'], winner: 'A' },
      { mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'B' },
    ];
    expect(store.statsFor(list, 'aram').get('철수').points).toBeGreaterThan(0);
    expect(store.statsFor(list, 'normal').get('철수').points).toBeLessThan(0);
  });

  test('여러 경기 결과가 같은 이름으로 누적된다', () => {
    const list = [
      { mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
      { mode: 'normal', teamA: ['민수'], teamB: ['철수'], winner: 'A', playedAt: 2 },
    ];
    const stats = store.statsFor(list, 'normal');
    expect(stats.get('철수')).toMatchObject({ wins: 1, losses: 1, games: 2 });
  });

  test('로스터에 없는 손님 이름도 그대로 집계된다', () => {
    const list = [{ mode: 'normal', teamA: ['지나가던행인'], teamB: ['철수'], winner: 'A' }];
    expect(store.statsFor(list, 'normal').get('지나가던행인').wins).toBe(1);
  });
});

test('pointsOf는 기록 없는 이름에 0을 준다', () => {
  const stats = store.statsFor(
    [{ mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A' }],
    'normal'
  );
  const mine = store.pointsOf(stats, '철수');
  expect(mine).toBeGreaterThan(0);
  expect(store.pointsOf(stats, '  철수  ')).toBe(mine); // 공백은 무시
  expect(store.pointsOf(stats, '없는사람')).toBe(0);
});
