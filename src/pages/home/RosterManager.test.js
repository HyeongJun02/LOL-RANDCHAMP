global.IS_REACT_ACT_ENVIRONMENT = true;

let act;

const render = () => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const RosterManager = require('./RosterManager').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(RosterManager)));
  return container;
};

const click = (el) =>
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

/* React는 값 추적기를 두고 있어서 el.value 대입만으로는 onChange가 안 뜬다.
   프로토타입의 네이티브 세터로 우회한다. */
const setValue = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  return act(() => el.dispatchEvent(new Event('change', { bubbles: true })));
};

const stored = () => JSON.parse(localStorage.getItem('lrc.roster'));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

test('팀원을 추가하고 이름·티어·디비전을 고치면 그대로 저장된다', () => {
  const el = render();

  click(el.querySelector('.member-add'));

  const row = el.querySelector('.member-row');
  setValue(row.querySelector('.member-name'), '철수');
  setValue(row.querySelector('.member-tier'), 'DIAMOND');
  setValue(row.querySelector('.member-div'), '2');

  expect(stored()[0]).toMatchObject({ name: '철수', tier: 'DIAMOND', division: 2 });
});

test('디비전이 없는 티어는 선택이 잠긴다', () => {
  const el = render();
  click(el.querySelector('.member-add'));

  const row = el.querySelector('.member-row');
  setValue(row.querySelector('.member-tier'), 'MASTER');

  expect(row.querySelector('.member-div').disabled).toBe(true);
  expect(stored()[0].tier).toBe('MASTER');
});

test('삭제하면 명단에서 빠진다', () => {
  const el = render();
  click(el.querySelector('.member-add'));
  setValue(el.querySelector('.member-name'), '철수');

  click(el.querySelector('.member-del'));
  expect(stored()).toEqual([]);
});
