global.IS_REACT_ACT_ENVIRONMENT = true;

let act;

const render = (props = {}) => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const RosterLoader = require('./RosterLoader').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() =>
    createRoot(container).render(
      React.createElement(RosterLoader, {
        present: [],
        onConfirm: jest.fn(),
        onClose: jest.fn(),
        ...props,
      })
    )
  );
  return container;
};

const click = (el) =>
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

const byText = (text) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);

const shownNames = () =>
  [...document.querySelectorAll('.loader-name')].map((n) => n.textContent);

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  localStorage.setItem(
    'lrc.roster',
    JSON.stringify([
      { id: 'c', name: '다현', tier: 'IRON', division: 4 },
      { id: 'a', name: '가영', tier: 'DIAMOND', division: 1 },
      { id: 'b', name: '나연', tier: 'SILVER', division: 2 },
    ])
  );
  localStorage.setItem(
    'lrc.matches',
    JSON.stringify([
      { id: 'm1', mode: 'normal', teamA: ['다현'], teamB: ['나연'], winner: 'A' },
      { id: 'm2', mode: 'aram', teamA: ['다현'], teamB: ['나연'], winner: 'B' },
      { id: 'm3', mode: 'normal', teamA: ['다현'], teamB: ['가영'], winner: 'A' },
    ])
  );
});

test('기본은 이름순', () => {
  render();
  expect(shownNames()).toEqual(['가영', '나연', '다현']);
});

test('티어순은 높은 티어부터', () => {
  render();
  click(byText('티어순'));
  expect(shownNames()).toEqual(['가영', '나연', '다현']); // 다이아 > 실버 > 아이언
});

test('내전순은 많이 한 사람부터', () => {
  render();
  click(byText('내전순'));
  // 다현 3판, 나연 2판, 가영 1판
  expect(shownNames()).toEqual(['다현', '나연', '가영']);
  expect(document.body.textContent).toContain('내전 3판');
});

test('자리가 모자라면 보이는 순서대로 위에서 채운다', () => {
  render({ limit: 2 });
  click(byText('내전순'));
  click(byText('위에서 2명'));

  const checked = [...document.querySelectorAll('.loader-list li')]
    .filter((li) => li.querySelector('input').checked)
    .map((li) => li.querySelector('.loader-name').textContent);
  expect(checked.sort()).toEqual(['나연', '다현'].sort());
});

test('정렬을 바꿔도 체크한 사람은 유지된다', () => {
  render();
  const 가영 = [...document.querySelectorAll('.loader-list li')].find((li) =>
    li.textContent.includes('가영')
  );
  click(가영.querySelector('input'));

  click(byText('내전순'));
  const still = [...document.querySelectorAll('.loader-list li')].find((li) =>
    li.textContent.includes('가영')
  );
  expect(still.querySelector('input').checked).toBe(true);
});
