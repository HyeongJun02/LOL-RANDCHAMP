import { filterChampions } from './filter';

const CHAMPS = [
  { id: 'Aatrox', name: '아트록스', tags: ['Fighter'] },
  { id: 'Ahri', name: '아리', tags: ['Mage', 'Assassin'] },
  { id: 'MonkeyKing', name: '오공', tags: ['Fighter', 'Tank'] },
];

const ids = (r) => r.map((c) => c.id);

test('필터 없으면 전부', () => {
  expect(ids(filterChampions(CHAMPS, [], ''))).toEqual(['Aatrox', 'Ahri', 'MonkeyKing']);
});

test('역할군은 OR — 태그 하나만 걸려도 통과', () => {
  expect(ids(filterChampions(CHAMPS, ['Assassin', 'Tank'], ''))).toEqual(['Ahri', 'MonkeyKing']);
});

test('한글 이름 부분 검색', () => {
  expect(ids(filterChampions(CHAMPS, [], '아'))).toEqual(['Aatrox', 'Ahri']);
});

test('영문 id 검색은 대소문자 무시', () => {
  expect(ids(filterChampions(CHAMPS, [], 'monkey'))).toEqual(['MonkeyKing']);
});

test('역할군과 검색어는 AND', () => {
  expect(ids(filterChampions(CHAMPS, ['Fighter'], '아'))).toEqual(['Aatrox']);
});

test('공백만 입력하면 검색어 없는 것으로 취급', () => {
  expect(filterChampions(CHAMPS, [], '   ')).toHaveLength(3);
});

test('라인 필터는 OR로 걸리고 역할군과는 AND', () => {
  const roster = [
    { id: 'Ahri', name: '아리', tags: ['Mage'] },       // 미드
    { id: 'Leona', name: '레오나', tags: ['Tank'] },     // 서폿
    { id: 'Malphite', name: '말파이트', tags: ['Tank'] }, // 탑, 서폿
  ];

  expect(ids(filterChampions(roster, [], '', ['미드']))).toEqual(['Ahri']);
  expect(ids(filterChampions(roster, [], '', ['서폿']))).toEqual(['Leona', 'Malphite']);
  expect(ids(filterChampions(roster, ['Tank'], '', ['탑']))).toEqual(['Malphite']);
});

test('라인 표에 없는 챔피언은 라인 필터가 걸리면 빠진다', () => {
  const roster = [{ id: 'Zaahen', name: '자헨', tags: ['Fighter'] }];

  expect(ids(filterChampions(roster, [], '', []))).toEqual(['Zaahen']);
  expect(ids(filterChampions(roster, [], '', ['탑']))).toEqual([]);
});

test('픽 유형 필터는 OR로 걸리고 다른 조건과는 AND', () => {
  const roster = [
    { id: 'Camille', name: '카밀', tags: ['Fighter'] },   // 변칙 서폿
    { id: 'Elise', name: '엘리스', tags: ['Mage'] },      // AP 정글
    { id: 'Jinx', name: '징크스', tags: ['Marksman'] },   // 어디에도 없음
  ];

  expect(ids(filterChampions(roster, [], '', [], ['oddsup']))).toEqual(['Camille']);
  expect(ids(filterChampions(roster, [], '', [], ['oddsup', 'apjungle']))).toEqual([
    'Camille',
    'Elise',
  ]);
  // 역할군과 AND
  expect(ids(filterChampions(roster, ['Mage'], '', [], ['oddsup', 'apjungle']))).toEqual([
    'Elise',
  ]);
  // 빈 배열이면 필터 안 함
  expect(ids(filterChampions(roster, [], '', [], []))).toHaveLength(3);
});
