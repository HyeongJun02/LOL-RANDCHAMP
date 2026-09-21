import { ROLL_MS, rollDelay } from './rollTiming';

test('갈수록 느려진다', () => {
  const delays = [0, 0.25, 0.5, 0.75, 1].map(rollDelay);
  expect(delays).toEqual([...delays].sort((a, b) => a - b));
  expect(new Set(delays).size).toBe(delays.length);
});

test('처음은 빠르고 끝은 눈에 보일 만큼 느리다', () => {
  expect(rollDelay(0)).toBeLessThan(60);
  expect(rollDelay(1)).toBeGreaterThan(250);
});

test('범위를 벗어난 값도 안전하게 막는다', () => {
  expect(rollDelay(-1)).toBe(rollDelay(0));
  expect(rollDelay(99)).toBe(rollDelay(1));
});

/* 간격이 계속 늘어나므로 루프가 끝나는지 확인해둔다 */
test('전체 시간 안에 반드시 끝난다', () => {
  let t = 0;
  let ticks = 0;
  while (t < ROLL_MS && ticks < 1000) {
    t += rollDelay(t / ROLL_MS);
    ticks += 1;
  }
  expect(t).toBeGreaterThanOrEqual(ROLL_MS);
  expect(ticks).toBeGreaterThan(10); // 너무 적으면 연출이 안 된다
  expect(ticks).toBeLessThan(60);
});
