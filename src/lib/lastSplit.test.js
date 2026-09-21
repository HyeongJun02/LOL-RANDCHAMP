const { saveLastSplit, loadLastSplit } = require('./lastSplit');

beforeEach(() => localStorage.clear());

test('저장한 팀 구성을 그대로 돌려준다', () => {
  saveLastSplit(['철수', '영희'], ['민수', '지훈']);
  const split = loadLastSplit();
  expect(split.teamA).toEqual(['철수', '영희']);
  expect(split.teamB).toEqual(['민수', '지훈']);
  expect(split.at).toBeGreaterThan(0);
});

test('저장된 게 없으면 null', () => {
  expect(loadLastSplit()).toBeNull();
});

test('데이터가 깨져 있으면 null', () => {
  localStorage.setItem('lrc.lastSplit', '{{망가진 json');
  expect(loadLastSplit()).toBeNull();
});

test('teamA/teamB가 배열이 아니면 null', () => {
  localStorage.setItem('lrc.lastSplit', JSON.stringify({ teamA: '철수', teamB: [] }));
  expect(loadLastSplit()).toBeNull();
});
