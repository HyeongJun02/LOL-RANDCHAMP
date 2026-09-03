import {
  streaksOf,
  duosOf,
  rivalsOf,
  underdogsOf,
  streakBreakersOf,
  busiestDayOf,
  lastSeenOf,
} from './matches';

let clock = 0;
const g = (teamA, teamB, winner, mode = 'normal') => ({
  id: `m${++clock}`,
  mode,
  teamA,
  teamB,
  winner,
  playedAt: clock,
});

beforeEach(() => {
  clock = 0;
});

describe('연승/연패', () => {
  test('연승 중이면 양수, 연패 중이면 음수', () => {
    const s = streaksOf([g(['철수'], ['영희'], 'A'), g(['철수'], ['영희'], 'A')], 'normal');
    expect(s.get('철수').current).toBe(2);
    expect(s.get('영희').current).toBe(-2);
  });

  test('한 번 지면 연승이 끊긴다', () => {
    const s = streaksOf(
      [
        g(['철수'], ['영희'], 'A'),
        g(['철수'], ['영희'], 'A'),
        g(['철수'], ['영희'], 'B'),
      ],
      'normal'
    );
    expect(s.get('철수').current).toBe(-1);
    expect(s.get('철수').bestWin).toBe(2); // 최고 기록은 남는다
  });

  test('기록 순서가 뒤섞여 들어와도 시간순으로 센다', () => {
    const list = [
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'B'),
    ];
    const shuffled = [list[2], list[0], list[1]];
    expect(streaksOf(shuffled, 'normal').get('철수').current).toBe(-1);
  });
});

describe('궁합 (같은 팀)', () => {
  const together = (n, winner) =>
    Array.from({ length: n }, () => g(['철수', '영희'], ['민수', '지훈'], winner));

  test('같이 뛴 판수와 승률을 낸다', () => {
    const [top] = duosOf(together(3, 'A'), 'normal');
    expect([top.a, top.b].sort()).toEqual(['영희', '철수']);
    expect(top.games).toBe(3);
    expect(top.rate).toBe(1);
  });

  test('표본이 적은 짝은 빼서 100%가 남발되지 않게 한다', () => {
    expect(duosOf(together(2, 'A'), 'normal')).toHaveLength(0);
    expect(duosOf(together(3, 'A'), 'normal').length).toBeGreaterThan(0);
  });

  test('승률 높은 짝이 앞에 온다', () => {
    const list = [...together(3, 'A'), ...together(1, 'B')];
    const rates = duosOf(list, 'normal').map((d) => d.rate);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });
});

describe('천적 (다른 팀)', () => {
  test('한쪽이 전승해도 진 사람 이름이 나온다', () => {
    const list = Array.from({ length: 3 }, () => g(['철수'], ['영희'], 'A'));
    const [top] = rivalsOf(list, 'normal');
    expect(top.winner).toBe('철수');
    expect(top.loser).toBe('영희'); // 전승이어도 상대를 안다
    expect(top.rate).toBe(1);
  });

  test('많이 이긴 쪽이 winner로 잡힌다', () => {
    const list = [
      g(['철수'], ['영희'], 'B'),
      g(['철수'], ['영희'], 'B'),
      g(['철수'], ['영희'], 'A'),
    ];
    const [top] = rivalsOf(list, 'normal');
    expect(top.winner).toBe('영희');
    expect(top.wins).toBe(2);
    expect(top.games).toBe(3);
  });

  test('같은 팀이었던 판은 상대 전적에 안 들어간다', () => {
    const list = Array.from({ length: 5 }, () => g(['철수', '영희'], ['민수'], 'A'));
    const pair = rivalsOf(list, 'normal').find(
      (r) => [r.winner, r.loser].sort().join() === ['영희', '철수'].sort().join()
    );
    expect(pair).toBeUndefined();
  });
});

test('모드가 다르면 섞이지 않는다', () => {
  const list = [g(['철수'], ['영희'], 'A', 'aram')];
  expect(streaksOf(list, 'normal').size).toBe(0);
  expect(streaksOf(list, 'aram').get('철수').current).toBe(1);
});

describe('언더독 / 연승 저격', () => {
  test('약팀이 강팀을 이기면 언더독으로 잡힌다', () => {
    /* 고수가 먼저 평점을 쌓아두고, 그 뒤 호구가 한 번 이긴다 */
    const seed = Array.from({ length: 10 }, () => g(['고수'], ['호구'], 'A'));
    const list = [...seed, g(['호구'], ['고수'], 'A')];

    expect(underdogsOf(list, 'normal').get('호구')).toBe(1);
    expect(underdogsOf(list, 'normal').get('고수')).toBeUndefined();
  });

  test('예상대로 이긴 판은 언더독이 아니다', () => {
    expect(underdogsOf([g(['철수'], ['영희'], 'A')], 'normal').size).toBe(0);
  });

  test('3연승 이상을 끊어야 저격으로 센다', () => {
    const two = [g(['철수'], ['영희'], 'A'), g(['철수'], ['영희'], 'A'), g(['철수'], ['영희'], 'B')];
    expect(streakBreakersOf(two, 'normal').size).toBe(0);

    clock = 0;
    const three = [
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'B'),
    ];
    expect(streakBreakersOf(three, 'normal').get('영희')).toBe(1);
  });
});

describe('날짜 통계', () => {
  const onDay = (y, m, d) => ({
    id: `d${++clock}`,
    mode: 'normal',
    teamA: ['철수'],
    teamB: ['영희'],
    winner: 'A',
    playedAt: new Date(y, m - 1, d, 21).getTime(),
  });

  test('가장 많이 한 날을 찾는다', () => {
    const list = [onDay(2026, 9, 1), onDay(2026, 9, 3), onDay(2026, 9, 3), onDay(2026, 9, 3)];
    expect(busiestDayOf(list, 'normal')).toEqual({ day: '2026-09-03', games: 3 });
  });

  test('기록이 없으면 null', () => {
    expect(busiestDayOf([], 'normal')).toBeNull();
  });

  test('마지막 출전 시각을 이름별로 준다', () => {
    const a = onDay(2026, 9, 1);
    const b = onDay(2026, 9, 5);
    const seen = lastSeenOf([a, b], 'normal');
    expect(seen.get('철수')).toBe(b.playedAt);
  });
});

describe('이름 바꾸기', () => {
  let store;
  const load = () => {
    jest.resetModules();
    store = require('./matches');
  };
  const seed = (list) => localStorage.setItem('lrc.matches', JSON.stringify(list));
  const stored = () => JSON.parse(localStorage.getItem('lrc.matches'));

  beforeEach(() => localStorage.clear());

  test('전적의 이름도 같이 바뀌고 바뀐 경기 수를 알려준다', () => {
    seed([
      { id: 'a', mode: 'normal', teamA: ['철수', '민수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
      { id: 'b', mode: 'aram', teamA: ['영희'], teamB: ['철수'], winner: 'A', playedAt: 2 },
      { id: 'c', mode: 'normal', teamA: ['민수'], teamB: ['영희'], winner: 'A', playedAt: 3 },
    ]);
    load();

    expect(store.renamePlayer('철수', '철수2')).toBe(2); // 철수가 낀 경기만
    const list = stored();
    expect(list[0].teamA).toEqual(['철수2', '민수']);
    expect(list[1].teamB).toEqual(['철수2']);
    expect(list[2].teamA).toEqual(['민수']); // 안 바뀐 경기는 그대로
  });

  test('이름이 그대로거나 비어 있으면 아무것도 안 한다', () => {
    seed([{ id: 'a', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 }]);
    load();

    expect(store.renamePlayer('철수', '철수')).toBe(0);
    expect(store.renamePlayer('', '철수')).toBe(0);
    expect(store.renamePlayer('철수', '  ')).toBe(0);
    expect(stored()[0].teamA).toEqual(['철수']);
  });

  test('기록에 없는 이름을 바꿔도 조용히 넘어간다', () => {
    seed([{ id: 'a', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 }]);
    load();
    expect(store.renamePlayer('없는사람', '누구')).toBe(0);
  });

  test('바꾼 뒤에는 한 사람으로 집계된다', () => {
    seed([
      { id: 'a', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
      { id: 'b', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 2 },
    ]);
    load();
    store.renamePlayer('철수', '새이름');

    const stats = store.statsFor(stored(), 'normal');
    expect(stats.get('새이름').wins).toBe(2);
    expect(stats.has('철수')).toBe(false);
  });
});
