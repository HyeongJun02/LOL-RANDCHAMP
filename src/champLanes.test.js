import fs from 'fs';
import path from 'path';
import { CHAMPION_LANES, LANE_META, lanesOf, countUnclassified } from './champLanes';
import { LINE_NAMES } from './lines';

const source = fs.readFileSync(path.join(__dirname, 'champLanes.js'), 'utf8');

test('모든 라인 값이 실제 라인 이름이다', () => {
  Object.entries(CHAMPION_LANES).forEach(([id, lanes]) => {
    lanes.forEach((lane) => {
      expect(LINE_NAMES).toContain(lane);
    });
  });
});

test('빈 배열이나 중복 라인이 없다', () => {
  Object.entries(CHAMPION_LANES).forEach(([id, lanes]) => {
    expect(lanes.length).toBeGreaterThan(0);
    expect(new Set(lanes).size).toBe(lanes.length);
  });
});

/* 손으로 173줄을 적는 표라, 같은 챔피언을 두 번 쓰면 뒤엣것이 조용히 덮어쓴다.
   객체가 된 뒤에는 알 수 없으니 소스에서 직접 센다 */
test('같은 챔피언이 두 번 적혀 있지 않다', () => {
  const table = source.slice(source.indexOf('CHAMPION_LANES = {'));
  const keys = [...table.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);

  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  expect(dupes).toEqual([]);
  expect(keys.length).toBe(Object.keys(CHAMPION_LANES).length);
});

test('출처와 갱신일이 비어 있지 않다', () => {
  expect(LANE_META.author).toBeTruthy();
  expect(LANE_META.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(LANE_META.note).toBeTruthy();
});

test('표에 없는 챔피언은 빈 배열이지 에러가 아니다', () => {
  expect(lanesOf('아직없는챔피언')).toEqual([]);
});

test('미분류 인원을 센다', () => {
  const champions = [{ id: 'Ahri' }, { id: 'Zaahen' }, { id: 'Locke' }];
  expect(countUnclassified(champions)).toBe(2);
});
