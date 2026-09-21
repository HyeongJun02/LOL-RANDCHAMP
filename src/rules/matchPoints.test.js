import { statsFor, pointsOf, K_FACTOR, PRIOR_GAMES } from './matches';

let clock = 0;
const game = (teamA, teamB, winner, mode = 'normal') => ({
  id: `m${clock}`,
  mode,
  teamA,
  teamB,
  winner,
  playedAt: ++clock,
});

const duel = (n, winner) =>
  Array.from({ length: n }, () => game(['철수'], ['영희'], winner));

beforeEach(() => {
  clock = 0;
});

test('이긴 사람은 오르고 진 사람은 내린다 (합은 0)', () => {
  const s = statsFor(duel(1, 'A'));
  expect(pointsOf(s, '철수')).toBeGreaterThan(0);
  expect(pointsOf(s, '영희')).toBe(-pointsOf(s, '철수'));
});

test('승패가 같으면 점수가 0 근처에 머문다', () => {
  const list = Array.from({ length: 10 }, (_, i) =>
    game(['철수'], ['영희'], i % 2 ? 'A' : 'B')
  );
  expect(Math.abs(pointsOf(statsFor(list), '철수'))).toBeLessThanOrEqual(1);
});

/* A: 상대가 셀수록 많이 준다 */
test('이미 강한 상대를 이기면 약한 상대를 이길 때보다 많이 오른다', () => {
  // 강자(고수)를 만들어 둔다
  const seed = Array.from({ length: 8 }, () => game(['고수'], ['호구'], 'A'));

  const beatStrong = statsFor([...seed, game(['도전자'], ['고수'], 'A')]);
  clock = 0;
  const seed2 = Array.from({ length: 8 }, () => game(['고수'], ['호구'], 'A'));
  const beatWeak = statsFor([...seed2, game(['도전자'], ['호구'], 'A')]);

  expect(pointsOf(beatStrong, '도전자')).toBeGreaterThan(pointsOf(beatWeak, '도전자'));
});

/* B: 판수가 적으면 조심스럽게 */
test('판수가 적으면 같은 전승이라도 점수가 낮다', () => {
  const few = pointsOf(statsFor(duel(2, 'A')), '철수');
  clock = 0;
  const many = pointsOf(statsFor(duel(20, 'A')), '철수');
  expect(many).toBeGreaterThan(few);
});

test('2판 2승이 폭주하지 않는다', () => {
  expect(pointsOf(statsFor(duel(2, 'A')), '철수')).toBeLessThan(K_FACTOR);
});

test('승패 수는 그대로 센다', () => {
  const s = statsFor([...duel(3, 'A'), game(['철수'], ['영희'], 'B')]);
  expect(s.get('철수')).toMatchObject({ wins: 3, losses: 1, games: 4 });
});

/* 모드는 더 이상 나누지 않는다. 칼바람에서 이겨도 같은 내전 포인트가 붙는다 */
test('칼바람 승리도 같은 내전 포인트로 쌓인다', () => {
  const aram = [game(['철수'], ['영희'], 'A', 'aram')];
  const normal = [game(['철수'], ['영희'], 'A', 'normal')];
  expect(pointsOf(statsFor(aram), '철수')).toBeGreaterThan(0);
  expect(pointsOf(statsFor(aram), '철수')).toBe(pointsOf(statsFor(normal), '철수'));
});

test('기록 순서가 뒤섞여 들어와도 시간순으로 계산한다', () => {
  const ordered = [...duel(3, 'A')];
  const shuffled = [ordered[2], ordered[0], ordered[1]];
  expect(pointsOf(statsFor(shuffled), '철수')).toBe(
    pointsOf(statsFor(ordered), '철수')
  );
});

test('상수가 문서화된 의도대로다', () => {
  expect(K_FACTOR).toBeLessThanOrEqual(4);
  expect(PRIOR_GAMES).toBeGreaterThan(0);
});
