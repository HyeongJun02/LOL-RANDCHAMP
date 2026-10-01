global.IS_REACT_ACT_ENVIRONMENT = true;

/* 로그아웃이 조용히 실패하던 자리.

   Neon Auth의 vanilla 클라이언트는 실패를 던지지 않고 { error }로 돌려준다.
   그걸 안 보고 지나가서, 화면만 로그아웃된 척하고 새로고침하면 다시 로그인
   상태로 돌아왔다. */

/* jest.mock 공장은 호이스팅돼 위로 올라간다. mock으로 시작하는 이름만
   공장 안에서 참조할 수 있다 */
const mockAuth = {
  getSession: jest.fn(),
  signOut: jest.fn(),
  signIn: { social: jest.fn() },
};

jest.mock('../server/neon', () => ({
  neon: { auth: mockAuth },
  isNeonConfigured: true,
}));

const USER = { id: 'u1', email: 'a@b.c' };

/* 로그아웃이 끝나면 통째로 새로 띄운다. jsdom은 실제 이동을 못 하므로
   어디로 보냈는지만 모아둔다 */
let went;

const render = async () => {
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { AuthProvider, useAuth } = require('./AuthContext');

  let api;
  const Probe = () => {
    api = useAuth();
    return React.createElement('span', null, api.user ? api.user.email : '-');
  };

  const container = document.createElement('div');
  document.body.appendChild(container);
  await React.act(async () =>
    createRoot(container).render(
      React.createElement(AuthProvider, null, React.createElement(Probe))
    )
  );
  return { container, get: () => api };
};

beforeEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
  went = [];
  delete window.location;
  window.location = { pathname: '/', assign: (to) => went.push(to) };
  mockAuth.getSession.mockResolvedValue({ data: { user: USER } });
});

test('세션을 읽어 로그인 상태를 잡는다', async () => {
  const { container } = await render();
  expect(container.textContent).toBe('a@b.c');
});

test('로그아웃이 실패하면 알려준다 (조용히 지나가지 않는다)', async () => {
  mockAuth.signOut.mockResolvedValue({ error: { message: '서버가 거절했어요.' } });
  const { get } = await render();

  await expect(get().signOut()).rejects.toThrow('서버가 거절했어요.');
  expect(went).toEqual([]);
});

/* signOut이 성공을 주고도 세션이 남는 경우가 있다. 그때 로그아웃된 척하면
   사람은 왜 다시 로그인 상태인지 알 방법이 없다 */
test('세션이 아직 남아 있으면 로그아웃된 척하지 않는다', async () => {
  mockAuth.signOut.mockResolvedValue({});
  const { get } = await render();

  await expect(get().signOut()).rejects.toThrow('로그아웃이 되지 않았어요');
  expect(went).toEqual([]);
});

test('정말 지워졌으면 첫 화면으로 새로 띄운다', async () => {
  mockAuth.signOut.mockResolvedValue({});
  const { get } = await render();
  /* 로그아웃 뒤의 확인에서는 사용자가 없어야 한다 */
  mockAuth.getSession.mockResolvedValue({ data: { user: null } });

  const React = require('react');
  await React.act(async () => {
    await get().signOut();
  });

  expect(went).toEqual(['/']);
});
