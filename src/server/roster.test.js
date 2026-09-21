const { defaultTierOf } = require('../rules/games');

const KEY = 'lrc.roster';

let store;

const load = () => {
  jest.resetModules();
  store = require('./roster');
};

const stored = () => JSON.parse(localStorage.getItem(KEY));

beforeEach(() => {
  localStorage.clear();
  load();
});

test('추가하면 id와 기본 티어가 붙는다', () => {
  store.addMember('lol', { name: '철수' });
  const [m] = stored();
  expect(m.name).toBe('철수');
  /* 기본 티어는 games.js에서 정한다. 여기에 박아두면 그걸 고칠 때마다
     관계없는 테스트가 깨진다 */
  expect({ tier: m.tier, division: m.division }).toEqual(defaultTierOf('lol'));
  expect(m.id).toBeTruthy();
});

test('수정과 삭제', () => {
  store.addMember('lol', { name: '철수' });
  const { id } = stored()[0];

  store.updateMember(id, { name: '영희', tier: 'DIAMOND', division: 2 });
  expect(stored()[0]).toMatchObject({ name: '영희', tier: 'DIAMOND', division: 2 });

  store.removeMember(id);
  expect(stored()).toEqual([]);
});

test('새로고침해도 남아 있다', () => {
  store.addMember('lol', { name: '철수', tier: 'MASTER' });
  load(); // 모듈 재적재 = 새로고침
  expect(stored()[0].name).toBe('철수');
});

test('mergeMembers는 같은 이름을 중복 추가하지 않고 티어만 갱신한다', () => {
  store.addMember('lol', { name: '철수', tier: 'SILVER', division: 3 });

  const added = store.mergeMembers('lol', [
    { name: '철수', tier: 'GOLD', division: 1 },
    { name: '영희', tier: 'EMERALD', division: 2 },
  ]);

  expect(added).toBe(1);
  expect(stored()).toHaveLength(2);
  expect(stored()[0]).toMatchObject({ name: '철수', tier: 'GOLD', division: 1 });
});

test('mergeMembers는 앞뒤 공백을 정리하고 빈 이름은 무시한다', () => {
  expect(store.mergeMembers('lol', [{ name: '  철수 ' }, { name: '   ' }])).toBe(1);
  expect(stored()[0].name).toBe('철수');
});

test('저장 데이터가 깨져 있어도 빈 명단으로 시작한다', () => {
  localStorage.setItem(KEY, '{{망가진 json');
  load();
  store.addMember('lol', { name: '철수' });
  expect(stored()).toHaveLength(1);
});

test('id 없던 옛 데이터도 살린다', () => {
  localStorage.setItem(KEY, JSON.stringify([{ name: '철수', tier: 'GOLD', division: 2 }]));
  load();
  store.addMember('lol', { name: '영희' });
  const all = stored();
  expect(all).toHaveLength(2);
  expect(all[0]).toMatchObject({ name: '철수', division: 2 });
  expect(all[0].id).toBeTruthy();
});

test('못 가는 라인도 저장되고, 없던 데이터는 빈 배열로 채워진다', () => {
  store.addMember('lol', { name: '철수', lines: ['탑', '정글'] });
  expect(stored()[0].lines).toEqual(['탑', '정글']);

  localStorage.setItem(KEY, JSON.stringify([{ name: '영희', tier: 'GOLD', division: 4 }]));
  load();
  store.addMember('lol', { name: '민수' });
  expect(stored()[0].lines).toEqual([]);
});
