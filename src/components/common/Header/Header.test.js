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

/* @neondatabase/neon-js는 ESM 전용 빌드라 jest 리졸버가 못 읽는다.
   Header 테스트는 로그인 UI 자체를 검증하지 않으니 미설정 상태로 갈음한다. */
jest.mock('../../../neon', () => ({ neon: null, isNeonConfigured: false }));

const render = () => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const Header = require('./Header').default;
  const { AuthProvider } = require('../../../auth/AuthContext');

  const container = document.createElement('div');
  document.body.appendChild(container);
  React.act(() =>
    createRoot(container).render(
      React.createElement(AuthProvider, null, React.createElement(Header))
    )
  );
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

/* 위 테스트들은 전부 neon 미설정 상태라 로그인 버튼/유저칩 자체가 안 그려진다.
   여기서는 useAuth를 직접 목킹해서 로그인 UI 분기를 실제로 통과시킨다. */
const renderWithAuth = (authValue) => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  jest.doMock('../../../auth/AuthContext', () => ({ useAuth: () => authValue }));
  const Header = require('./Header').default;

  const container = document.createElement('div');
  document.body.appendChild(container);
  React.act(() => createRoot(container).render(React.createElement(Header)));
  return container;
};

const click = (el) =>
  require('react').act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

test('설정은 됐지만 세션 확인 중이면 로그인 버튼도 유저칩도 안 뜬다', () => {
  const el = renderWithAuth({ configured: true, loading: true, user: null, signOut: jest.fn() });
  expect(el.querySelector('.login-btn')).toBeNull();
  expect(el.querySelector('.user-chip')).toBeNull();
});

test('로그아웃 상태면 로그인 버튼이 뜨고, 누르면 모달이 열린다', () => {
  const el = renderWithAuth({ configured: true, loading: false, user: null, signOut: jest.fn() });
  const btn = el.querySelector('.login-btn');
  expect(btn).not.toBeNull();

  click(btn);
  // Modal은 document.body로 포탈되므로 el이 아니라 document에서 찾는다
  expect(document.querySelector('.modal-backdrop')).not.toBeNull();
});

test('로그인 상태면 아바타와 이름이 뜨고, 눌러야 로그아웃이 보인다', () => {
  const signOut = jest.fn().mockResolvedValue();
  const el = renderWithAuth({
    configured: true,
    loading: false,
    user: { name: '철수', email: 'chulsu@example.com' },
    signOut,
  });

  expect(el.querySelector('.login-btn')).toBeNull();
  expect(el.querySelector('.user-name').textContent).toBe('철수');
  // 사진이 없으면 이름 첫 글자로 떨어진다
  expect(el.querySelector('.avatar-letter').textContent).toBe('철');
  // 로그아웃은 메뉴를 열기 전엔 안 보인다
  expect(el.querySelector('.user-signout')).toBeNull();

  click(el.querySelector('.user-trigger'));
  expect(el.querySelector('.user-info').textContent).toContain('chulsu@example.com');

  click(el.querySelector('.user-signout'));
  expect(signOut).toHaveBeenCalledTimes(1);
  // 고르고 나면 메뉴가 닫힌다
  expect(el.querySelector('.user-dropdown')).toBeNull();
});

test('프로필 사진이 있으면 사진을 쓴다', () => {
  const el = renderWithAuth({
    configured: true,
    loading: false,
    user: { name: '철수', email: 'c@e.com', image: 'https://example.com/me.png' },
    signOut: jest.fn(),
  });

  const img = el.querySelector('.user-avatar img');
  expect(img.getAttribute('src')).toBe('https://example.com/me.png');
  /* 구글 이미지 호스트는 referrer가 붙으면 403을 주기도 한다 */
  expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(el.querySelector('.avatar-letter')).toBeNull();
});
