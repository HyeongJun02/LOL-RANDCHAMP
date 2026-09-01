global.IS_REACT_ACT_ENVIRONMENT = true;

/* react-router-dom v7은 ESM 전용이라 jest 리졸버가 못 읽는다.
   여기서 필요한 건 링크 마크업뿐이라 <a>로 갈음한다. */
jest.mock(
  'react-router-dom',
  () => {
    const React = require('react');
    const anchor = ({ to, children, className, ...rest }) =>
      React.createElement(
        'a',
        {
          ...rest,
          href: to,
          className: typeof className === 'function' ? className({ isActive: false }) : className,
        },
        children
      );
    return { Link: anchor, NavLink: anchor };
  },
  { virtual: true }
);

const render = () => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const Header = require('./Header').default;

  const container = document.createElement('div');
  document.body.appendChild(container);
  React.act(() => createRoot(container).render(React.createElement(Header)));
  return container;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

test('모든 탭에 아이콘이 실제로 그려진다', () => {
  const el = render();
  const links = el.querySelectorAll('.nav-link');

  expect(links.length).toBeGreaterThan(0);
  links.forEach((link) => {
    expect(link.querySelector('.nav-icon svg')).not.toBeNull();
  });
});

test('아이콘과 라벨은 서로 다른 클래스여야 한다', () => {
  const el = render();
  const link = el.querySelector('.nav-link');

  // 좁은 화면에서 .nav-link span 으로 싸잡아 숨기면 아이콘까지 사라진다
  expect(link.querySelector('.nav-label')).not.toBeNull();
  expect(link.querySelector('.nav-icon').classList.contains('nav-label')).toBe(false);
});

test('라벨이 숨겨져도 읽을 수 있도록 이름이 남아 있다', () => {
  const el = render();
  el.querySelectorAll('.nav-link').forEach((link) => {
    expect(link.getAttribute('aria-label')).toBeTruthy();
    expect(link.getAttribute('title')).toBeTruthy();
  });
});
