const KEY = 'lrc.matches';

let store;

const load = () => {
  jest.resetModules();
  store = require('./matches');
};

const stored = () => JSON.parse(localStorage.getItem(KEY));

beforeEach(() => {
  localStorage.clear();
  load();
});

test('기록하면 id와 시각이 붙어 저장된다', () => {
  store.addMatch({ mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A' });
  const [m] = stored();
  expect(m.id).toBeTruthy();
  expect(m.playedAt).toBeGreaterThan(0);
  expect(m).toMatchObject({ mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A' });
});

test('삭제하면 사라진다', () => {
  store.addMatch({ mode: 'aram', teamA: ['a'], teamB: ['b'], winner: 'A' });
  const { id } = stored()[0];
  store.removeMatch(id);
  expect(stored()).toEqual([]);
});

test('새로고침해도 남아 있다', () => {
  store.addMatch({ mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'B' });
  load();
  expect(stored()).toHaveLength(1);
});

test('저장 데이터가 깨져 있어도 빈 기록으로 시작한다', () => {
  localStorage.setItem(KEY, '{{망가진 json');
  load();
  store.addMatch({ mode: 'normal', teamA: ['a'], teamB: ['b'], winner: 'A' });
  expect(stored()).toHaveLength(1);
});

describe('statsFor', () => {
  test('이긴 팀은 승 +1, 포인트 +2 / 진 팀은 패 +1, 포인트 -2', () => {
    const list = [
      { mode: 'normal', teamA: ['철수', '영희'], teamB: ['민수', '지훈'], winner: 'A' },
    ];
    const stats = store.statsFor(list, 'normal');
    expect(stats.get('철수')).toEqual({ wins: 1, losses: 0, points: 2 });
    expect(stats.get('민수')).toEqual({ wins: 0, losses: 1, points: -2 });
  });

  test('다른 모드는 섞이지 않는다', () => {
    const list = [
      { mode: 'aram', teamA: ['철수'], teamB: ['영희'], winner: 'A' },
      { mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'B' },
    ];
    expect(store.statsFor(list, 'aram').get('철수').points).toBe(2);
    expect(store.statsFor(list, 'normal').get('철수').points).toBe(-2);
  });

  test('여러 경기 결과가 같은 이름으로 누적된다', () => {
    const list = [
      { mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A' },
      { mode: 'normal', teamA: ['민수'], teamB: ['철수'], winner: 'A' },
    ];
    const stats = store.statsFor(list, 'normal');
    expect(stats.get('철수')).toEqual({ wins: 1, losses: 1, points: 0 });
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
  expect(store.pointsOf(stats, '철수')).toBe(2);
  expect(store.pointsOf(stats, '  철수  ')).toBe(2);
  expect(store.pointsOf(stats, '없는사람')).toBe(0);
});
