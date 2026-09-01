import { parseItems, addItems, poolOf } from './pick';

test('줄바꿈과 쉼표로 끊고 공백은 버린다', () => {
  expect(parseItems(' 철수 , 영희 \n 민수 ')).toEqual(['철수', '영희', '민수']);
});

test('빈 줄과 중복은 버린다', () => {
  expect(parseItems('철수\n\n철수\n,\n영희')).toEqual(['철수', '영희']);
});

test('항목 안의 공백은 살린다', () => {
  expect(parseItems('롤 한 판\n옵치')).toEqual(['롤 한 판', '옵치']);
});

test('기존 목록에 이어 붙이되 이미 있는 건 안 넣는다', () => {
  expect(addItems(['철수'], '영희, 철수')).toEqual(['철수', '영희']);
});

test('빈 입력은 목록을 그대로 둔다', () => {
  expect(addItems(['철수'], '   \n , ')).toEqual(['철수']);
});

test('제외가 꺼져 있으면 전체가 후보', () => {
  expect(poolOf(['가', '나', '다'], ['가'], false)).toEqual(['가', '나', '다']);
});

test('제외가 켜져 있으면 이미 뽑은 건 빠진다', () => {
  expect(poolOf(['가', '나', '다'], ['가', '다'], true)).toEqual(['나']);
});
