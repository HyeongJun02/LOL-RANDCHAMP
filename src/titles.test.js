import { titlesOf } from './titles';

const g = (teamA, teamB, winner, playedAt = 1) => ({ teamA, teamB, winner, playedAt });

/* 최근 경기가 앞에 오든 뒤에 오든 matches.js가 시간순으로 정렬해서 본다 */
const duel = (n, winner, from = 1) =>
  Array.from({ length: n }, (_, i) => g(['철수'], ['영희'], winner, from + i));

test('연승 중이면 그 사람에게 붙는다', () => {
  const t = titlesOf({ matches: duel(3, 'A') });
  expect(t.get('철수')).toMatchObject({ label: '3연승 중', tone: 'hot' });
});

test('연패도 붙는다 (놀리라고 있는 자리다)', () => {
  const t = titlesOf({ matches: duel(3, 'A') });
  expect(t.get('영희')).toMatchObject({ label: '3연패 중', tone: 'cold' });
});

test('2연승은 아직 아니다 (아무나 받으면 배지가 값이 없다)', () => {
  const t = titlesOf({ matches: duel(2, 'A') });
  expect(t.get('철수')).toBeUndefined();
});

/* 여러 개를 달면 배지 더미가 되고 무엇이 대단한 건지 흐려진다 */
test('한 사람에게 하나만 준다', () => {
  const many = [
    ...duel(5, 'A'),
    ...Array.from({ length: 4 }, (_, i) => g(['철수', '민수'], ['영희', '지훈'], 'A', 10 + i)),
  ];
  const t = titlesOf({ matches: many });
  const mine = t.get('철수');
  expect(mine).toBeDefined();
  expect(typeof mine.label).toBe('string');
});

test('퍼블을 많이 딴 사람에게 사냥꾼이 붙는다', () => {
  /* 승패로는 아무 칭호도 안 붙게 두 판만 두고, 퍼블만 몰아준다 */
  const matches = [g(['가'], ['나'], 'A', 1), g(['나'], ['가'], 'A', 2)];
  const players = [
    { id: 1, name: '가' },
    { id: 2, name: '나' },
  ];
  const scrims = [
    { first_blood_player_id: 1 },
    { first_blood_player_id: 1 },
    { first_blood_player_id: 2 },
  ];
  const t = titlesOf({ matches, scrims, players });
  expect(t.get('가')).toMatchObject({ label: '퍼블 2회', tone: 'fb' });
  expect(t.get('나')).toBeUndefined();
});

/* 방이 통째로 쉬었을 때 전원이 유령이 되면 안 된다. 기준은 '오늘'이 아니라
   방의 마지막 경기다 */
test('남들은 뛰는데 안 나온 사람만 유령으로 잡힌다', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const base = Date.UTC(2026, 0, 1);
  const matches = [
    g(['가'], ['나'], 'A', base),
    g(['다'], ['라'], 'A', base + 30 * DAY),
  ];
  const t = titlesOf({ matches });
  expect(t.get('가').tone).toBe('ghost');
  expect(t.get('가').label).toContain('안 보임');
  /* 마지막 판에 뛴 사람은 유령이 아니다 */
  expect(t.get('다')?.tone).not.toBe('ghost');
});

test('방이 통째로 오래 쉬어도 전원이 유령이 되지는 않는다', () => {
  const long = Date.UTC(2020, 0, 1);
  const t = titlesOf({ matches: [g(['가'], ['나'], 'A', long)] });
  expect([...t.values()].some((v) => v.tone === 'ghost')).toBe(false);
});

test('기록이 없으면 아무에게도 안 붙는다', () => {
  expect(titlesOf({}).size).toBe(0);
  expect(titlesOf({ matches: [] }).size).toBe(0);
});
