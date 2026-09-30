import { glyphsOf, clipEmblem, EMBLEM_MAX } from './roomStyle';

/* 엠블럼을 직접 적을 수 있게 열어두면서, 칸을 뚫고 나가거나 DB가 거절하는
   값이 들어가지 않게 막는 자리다 */

test('사람이 세는 대로 글자 수를 센다', () => {
  expect(glyphsOf('GG')).toBe(2);
  /* '⚔️'는 코드로는 둘이다. 문자열 길이로 세면 이모지 하나가 두 글자가 된다 */
  expect('⚔️'.length).toBe(2);
  expect(glyphsOf('⚔️')).toBe(1);
  expect(glyphsOf('')).toBe(0);
});

test('세 글자까지만 남긴다', () => {
  expect(clipEmblem('ABCDE')).toBe('ABC');
  expect(glyphsOf(clipEmblem('⚔️⚔️⚔️⚔️'))).toBe(EMBLEM_MAX);
  /* 공백은 아예 뺀다. 가운데가 비면 칸 안에서 한쪽으로 쏠린다 */
  expect(clipEmblem(' G G ')).toBe('GG');
});

/* 화면에서 통과시킨 값이 서버에서 거절당하면 사람은 왜 안 되는지 모른다.
   DB는 코드 여덟 개까지만 받는다 (rooms_emblem_chk) */
test('DB가 받는 길이를 넘기지 않는다', () => {
  const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
  expect([...family].length).toBe(5);
  /* 셋을 적으면 코드가 열다섯이라, 들어갈 만큼만 남는다 */
  const out = clipEmblem(family + family + family);
  expect([...out].length).toBeLessThanOrEqual(8);
  expect(out).toBe(family);
});
