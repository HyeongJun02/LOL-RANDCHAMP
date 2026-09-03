import { streaksOf, duosOf, rivalsOf } from './matches';

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
