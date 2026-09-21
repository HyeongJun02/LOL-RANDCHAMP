import { scrimKingOf } from './HallOfFame';
import { HOF_MIN_GAMES, HOF_MIN_SHARE } from '../../rules/tuning';

/* 그 달에 치른 경기 하나. playedAt만 맞으면 된다 */
let seq = 0;
const game = (month, teamA, teamB, winner) => ({
  id: `g${(seq += 1)}`,
  mode: 'normal',
  teamA,
  teamB,
  winner,
  playedAt: new Date(2026, month - 1, 10, 21, seq % 50).getTime(),
});

const MONTH = '2026-09';

/* 매번 이긴 쪽에 같은 사람을 넣어 그 사람이 1위가 되게 만든다 */
const wins = (name, n, month = 9) =>
  Array.from({ length: n }, () => game(month, [name, '들러리'], ['상대', '상대2'], 'A'));

beforeEach(() => {
  seq = 0;
});

test('기록이 없는 달은 왕이 없다', () => {
  expect(scrimKingOf([], MONTH)).toBeNull();
  expect(scrimKingOf(wins('철수', 5, 8), MONTH)).toBeNull();
});

test('충분히 뛴 사람이 왕이 된다', () => {
  const king = scrimKingOf(wins('철수', 6), MONTH);
  expect(king.name).toBe('철수');
  expect(king.wins).toBe(6);
  expect(king.losses).toBe(0);
  expect(king.rate).toBe(100);
  expect(king.points).toBeGreaterThan(0);
});

/* 요점: 두 판 뛰고 전승한 사람이 그 달의 왕이 되면 아무도 인정하지 않는다 */
test('몇 판 안 뛰고 전승한 사람은 왕관을 못 쓴다', () => {
  const list = [
    ...wins('꾸준이', 9),
    /* 한 판만 나와서 이기고 사라진 사람 */
    game(9, ['반짝이'], ['상대'], 'A'),
  ];
  const need = Math.max(HOF_MIN_GAMES, Math.ceil(list.length * HOF_MIN_SHARE));
  expect(need).toBeGreaterThan(1);

  const king = scrimKingOf(list, MONTH);
  expect(king.name).not.toBe('반짝이');
  expect(king.games).toBeGreaterThanOrEqual(need);
});

/* 빈 왕좌보다는 낫다 - 문턱을 아무도 못 넘으면 절대 최소만 본다 */
test('아무도 문턱을 못 넘으면 최소 판수만 적용한다', () => {
  /* 12판인데 다들 조금씩만 뛴 달. 비율 문턱(4판)을 넘는 사람이 없다 */
  const list = [];
  for (let i = 0; i < 4; i += 1) {
    list.push(...wins(`선수${i}`, 3));
  }
  const need = Math.max(HOF_MIN_GAMES, Math.ceil(list.length * HOF_MIN_SHARE));
  expect(need).toBeGreaterThan(3);

  const king = scrimKingOf(list, MONTH);
  expect(king).not.toBeNull();
  expect(king.games).toBeGreaterThanOrEqual(HOF_MIN_GAMES);
});

test('절대 최소도 못 넘으면 왕이 없다', () => {
  expect(scrimKingOf([game(9, ['혼자'], ['상대'], 'A')], MONTH)).toBeNull();
});

test('승률은 그 달 기록만으로 센다', () => {
  /* 철수만 5판(4승 1패). 같은 편이 매번 달라야 철수가 혼자 꼭대기에 선다 -
     고정 짝꿍을 두면 그 사람이 5전 5승이 되어 더 높이 올라간다 */
  const list = [
    game(9, ['철수', 'a1'], ['상대'], 'A'),
    game(9, ['철수', 'a2'], ['상대'], 'A'),
    game(9, ['철수', 'a3'], ['상대'], 'A'),
    game(9, ['철수', 'a4'], ['상대'], 'A'),
    game(9, ['상대'], ['철수', 'a5'], 'A'),
  ];
  const king = scrimKingOf(list, MONTH);
  expect(king.name).toBe('철수');
  expect(king.games).toBe(5);
  expect(king.rate).toBe(80);
});
