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
    const s = streaksOf([g(['철수'], ['영희'], 'A'), g(['철수'], ['영희'], 'A')]);
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
    expect(streaksOf(shuffled).get('철수').current).toBe(-1);
  });
});

describe('궁합 (같은 팀)', () => {
  const together = (n, winner) =>
    Array.from({ length: n }, () => g(['철수', '영희'], ['민수', '지훈'], winner));

  test('같이 뛴 판수와 승률을 낸다', () => {
    const [top] = duosOf(together(3, 'A'));
    expect([top.a, top.b].sort()).toEqual(['영희', '철수']);
    expect(top.games).toBe(3);
    expect(top.rate).toBe(1);
  });

  test('표본이 적은 짝은 빼서 100%가 남발되지 않게 한다', () => {
    expect(duosOf(together(2, 'A'))).toHaveLength(0);
    expect(duosOf(together(3, 'A')).length).toBeGreaterThan(0);
  });

  test('승률 높은 짝이 앞에 온다', () => {
    const list = [...together(3, 'A'), ...together(1, 'B')];
    const rates = duosOf(list).map((d) => d.rate);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });
});

describe('천적 (다른 팀)', () => {
  test('한쪽이 전승해도 진 사람 이름이 나온다', () => {
    const list = Array.from({ length: 3 }, () => g(['철수'], ['영희'], 'A'));
    const [top] = rivalsOf(list);
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
    const [top] = rivalsOf(list);
    expect(top.winner).toBe('영희');
    expect(top.wins).toBe(2);
    expect(top.games).toBe(3);
  });

  test('같은 팀이었던 판은 상대 전적에 안 들어간다', () => {
    const list = Array.from({ length: 5 }, () => g(['철수', '영희'], ['민수'], 'A'));
    const pair = rivalsOf(list).find(
      (r) => [r.winner, r.loser].sort().join() === ['영희', '철수'].sort().join()
    );
    expect(pair).toBeUndefined();
  });
});

/* 모드를 갈라 세지 않는다. 칼바람 한 판, 일반 한 판이면 2연승이다 */
test('칼바람과 일반이 한 흐름으로 이어진다', () => {
  const list = [g(['철수'], ['영희'], 'A', 'aram'), g(['철수'], ['영희'], 'A', 'normal')];
  expect(streaksOf(list).get('철수').current).toBe(2);
});

describe('언더독 / 연승 저격', () => {
  test('약팀이 강팀을 이기면 언더독으로 잡힌다', () => {
    /* 고수가 먼저 평점을 쌓아두고, 그 뒤 호구가 한 번 이긴다 */
    const seed = Array.from({ length: 10 }, () => g(['고수'], ['호구'], 'A'));
    const list = [...seed, g(['호구'], ['고수'], 'A')];

    expect(underdogsOf(list).get('호구')).toBe(1);
    expect(underdogsOf(list).get('고수')).toBeUndefined();
  });

  test('예상대로 이긴 판은 언더독이 아니다', () => {
    expect(underdogsOf([g(['철수'], ['영희'], 'A')]).size).toBe(0);
  });

  test('3연승 이상을 끊어야 저격으로 센다', () => {
    const two = [g(['철수'], ['영희'], 'A'), g(['철수'], ['영희'], 'A'), g(['철수'], ['영희'], 'B')];
    expect(streakBreakersOf(two).size).toBe(0);

    clock = 0;
    const three = [
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'A'),
      g(['철수'], ['영희'], 'B'),
    ];
    expect(streakBreakersOf(three).get('영희')).toBe(1);
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
    expect(busiestDayOf(list)).toEqual({ day: '2026-09-03', games: 3 });
  });

  test('기록이 없으면 null', () => {
    expect(busiestDayOf([])).toBeNull();
  });

  test('마지막 출전 시각을 이름별로 준다', () => {
    const a = onDay(2026, 9, 1);
    const b = onDay(2026, 9, 5);
    const seen = lastSeenOf([a, b]);
    expect(seen.get('철수')).toBe(b.playedAt);
  });
});

/* 이름 바꾸기 테스트는 없앴다. 방의 경기는 참가자 id를 담으므로
   이름을 바꿔도 갈아끼울 전적이 없다 (rooms.js의 toMatches가 붙여준다).
   그 동작은 rooms.test.js에서 본다 */
