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
