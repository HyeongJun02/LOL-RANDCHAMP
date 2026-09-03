import { drawReport, downloadReport } from './reportImage';

const data = {
  periodLabel: '2026년 9월',
  modeLabel: '일반',
  played: 3,
  ranking: [{ name: '철수', wins: 2, losses: 1, games: 3, points: 2 }],
  insights: [{ key: 'hot', label: '지금 연승 중', value: '철수 2연승' }],
};

/* jsdom에는 캔버스 구현이 없다. 여기서 확인할 건 '없는 환경에서
   조용히 실패하고 앱을 안 죽인다'는 것 */
test('캔버스를 못 쓰면 null을 준다', () => {
  expect(drawReport(data)).toBeNull();
});

test('저장도 던지지 않고 false로 끝난다', async () => {
  await expect(downloadReport(data, 'x.png')).resolves.toBe(false);
});

test('캔버스가 있으면 리포트 줄 수에 맞춰 크기를 잡는다', () => {
  const calls = [];
  const ctx = {
    fillRect: () => {},
    strokeRect: () => {},
    fillText: (t) => calls.push(t),
    set font(v) {},
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
    set textBaseline(v) {},
  };
  const canvas = { getContext: () => ctx, width: 0, height: 0 };
  const spy = jest.spyOn(document, 'createElement').mockReturnValue(canvas);

  const out = drawReport(data);

  expect(out).toBe(canvas);
  expect(canvas.width).toBe(720);
  expect(canvas.height).toBeGreaterThan(100);
  expect(calls).toContain('[롤랜챔] 2026년 9월 일반 정산');
  expect(calls).toContain('🥇 철수 2승 1패 (67%) +2');
  expect(calls).toContain('lol-randchamp.vercel.app');

  spy.mockRestore();
});
