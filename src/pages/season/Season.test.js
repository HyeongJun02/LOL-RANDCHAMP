import { monthKeyOf, monthsOf, inMonth, monthLabel } from '../../matches';

const at = (y, m, d) => new Date(y, m - 1, d, 21, 0).getTime();

test('로컬 시각 기준으로 YYYY-MM을 만든다', () => {
  expect(monthKeyOf(at(2026, 9, 3))).toBe('2026-09');
  expect(monthKeyOf(at(2026, 12, 31))).toBe('2026-12');
});

test('기록이 있는 달만 최신순으로 준다', () => {
  const list = [
    { playedAt: at(2026, 8, 5) },
    { playedAt: at(2026, 10, 1) },
    { playedAt: at(2026, 8, 20) },
  ];
  expect(monthsOf(list)).toEqual(['2026-10', '2026-08']);
});

test('달을 넘나드는 기록이 섞이지 않는다', () => {
  const list = [
    { id: 'a', playedAt: at(2026, 9, 30) },
    { id: 'b', playedAt: at(2026, 10, 1) },
  ];
  expect(inMonth(list, '2026-09').map((m) => m.id)).toEqual(['a']);
  expect(inMonth(list, '2026-10').map((m) => m.id)).toEqual(['b']);
});

test('기록이 없으면 빈 배열', () => {
  expect(monthsOf([])).toEqual([]);
});

test('라벨은 0을 떼고 보여준다', () => {
  expect(monthLabel('2026-09')).toBe('2026년 9월');
  expect(monthLabel('2026-12')).toBe('2026년 12월');
});

/* ---------- 화면 ---------- */

global.IS_REACT_ACT_ENVIRONMENT = true;

/* Season은 이제 방이 넘겨주는 경기 목록만 그린다 */
const renderPage = (matches) => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const Season = require('./Season').default;

  const container = document.createElement('div');
  document.body.appendChild(container);
  React.act(() =>
    createRoot(container).render(React.createElement(Season, { matches, players: [] }))
  );
  return container;
};

const clickText = (el, text) =>
  require('react').act(() =>
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === text)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  );

let seq = 0;
const game = (y, m, winner) => ({
  id: `g${++seq}`,
  mode: 'normal',
  teamA: ['철수'],
  teamB: ['영희'],
  winner,
  playedAt: new Date(y, m - 1, 10, 21).getTime(),
});

beforeEach(() => {
  document.body.innerHTML = '';
});

test('달 탭과 전체 시즌 탭이 같이 뜬다', () => {
  const el = renderPage([game(2026, 8, 'A'), game(2026, 9, 'A')]);

  const tabs = [...el.querySelectorAll('.season-month')].map((b) => b.textContent);
  expect(tabs).toEqual(['전체 시즌', '2026년 9월', '2026년 8월']);
  // 기본은 최근 달
  expect(el.querySelector('.season-month.active').textContent).toBe('2026년 9월');
});

test('전체 시즌은 모든 달을 합쳐 센다', () => {
  const el = renderPage([game(2026, 8, 'A'), game(2026, 9, 'A'), game(2026, 9, 'B')]);

  expect(el.querySelector('.season-summary').textContent).toContain('2경기'); // 9월만
  clickText(el, '전체 시즌');
  expect(el.querySelector('.season-summary').textContent).toContain('3경기');
});

test('숨은 기록이 고른 기간을 따라간다', () => {
  const el = renderPage([game(2026, 8, 'A'), game(2026, 9, 'A'), game(2026, 9, 'A')]);

  // 9월만 보면 2연승
  expect(el.querySelector('.season-insights').textContent).toContain('2연승');

  clickText(el, '전체 시즌');
  // 8월까지 합치면 3연승
  expect(el.querySelector('.season-insights').textContent).toContain('3연승');
});

test('기록이 없으면 안내만 뜬다', () => {
  const el = renderPage([]);
  expect(el.querySelector('.season-blank')).not.toBeNull();
  expect(el.querySelector('.season-month')).toBeNull();
});
