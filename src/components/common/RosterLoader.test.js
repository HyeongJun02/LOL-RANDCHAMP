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

/* '내전순' 정렬은 없앴다. 전적이 방으로 옮겨가면서 이 명단에는
   셀 판수가 없다 (이 명단은 로그인 없이 쓰는 도구들 것이다) */
test('정렬 선택지는 이름순과 티어순뿐이다', () => {
  render();
  expect(byText('내전순')).toBeUndefined();
});

test('자리가 모자라면 보이는 순서대로 위에서 채운다', () => {
  render({ limit: 2 });
  click(byText('티어순'));
  click(byText('위에서 2명'));

  const checked = [...document.querySelectorAll('.loader-list li')]
    .filter((li) => li.querySelector('input').checked)
    .map((li) => li.querySelector('.loader-name').textContent);
  expect(checked.sort()).toEqual(['가영', '나연'].sort()); // 다이아 > 실버 > 아이언
});

test('정렬을 바꿔도 체크한 사람은 유지된다', () => {
  render();
  const 가영 = [...document.querySelectorAll('.loader-list li')].find((li) =>
    li.textContent.includes('가영')
  );
  click(가영.querySelector('input'));

  click(byText('티어순'));
  const still = [...document.querySelectorAll('.loader-list li')].find((li) =>
    li.textContent.includes('가영')
  );
  expect(still.querySelector('input').checked).toBe(true);
});
