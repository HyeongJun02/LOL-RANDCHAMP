import { formatReport } from './report';

const base = {
  periodLabel: '2026년 9월',
  modeLabel: '일반',
  played: 12,
  ranking: [
    { name: '철수', wins: 8, losses: 4, games: 12, points: 7 },
    { name: '영희', wins: 4, losses: 8, games: 12, points: -7 },
  ],
  insights: [
    { key: 'hot', label: '지금 연승 중', value: '철수 3연승' },
    { key: 'cold', label: '지금 연패 중', value: null },
  ],
};

test('붙여넣기 좋은 형태로 만든다', () => {
  const text = formatReport(base);
  expect(text).toContain('[롤랜챔] 2026년 9월 일반 정산');
  expect(text).toContain('12경기 · 2명');
  expect(text).toContain('🥇 철수 8승 4패 (67%) +7');
  expect(text).toContain('🥈 영희 4승 8패 (33%) -7');
});

test('4위부터는 숫자로 매긴다', () => {
  const ranking = Array.from({ length: 4 }, (_, i) => ({
    name: `p${i}`,
    wins: 1,
    losses: 0,
    games: 1,
    points: 1,
  }));
  expect(formatReport({ ...base, ranking })).toContain('4. p3');
});

test('값이 없는 숨은 기록은 빼고 붙인다', () => {
  const text = formatReport(base);
  expect(text).toContain('지금 연승 중: 철수 3연승');
  expect(text).not.toContain('지금 연패 중');
});

test('숨은 기록이 전부 비면 그 단락 자체를 안 넣는다', () => {
  const text = formatReport({ ...base, insights: [{ label: 'x', value: null }] });
  expect(text).not.toContain('숨은 기록');
});

test('기록이 없으면 그렇게 말한다', () => {
  const text = formatReport({ ...base, played: 0, ranking: [], insights: [] });
  expect(text).toContain('기록 없음');
});

test('0판인 사람이 있어도 승률 계산에서 안 터진다', () => {
  const text = formatReport({
    ...base,
    ranking: [{ name: '유령', wins: 0, losses: 0, games: 0, points: 0 }],
  });
  expect(text).toContain('유령 0승 0패');
  expect(text).not.toContain('NaN');
});
