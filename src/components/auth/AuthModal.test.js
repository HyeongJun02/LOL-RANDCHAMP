global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

/* jest.mock 팩토리는 mock으로 시작하는 이름만 밖에서 끌어올 수 있다 */
const mockSignInWithGoogle = jest.fn();
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ signInWithGoogle: mockSignInWithGoogle }),
}));

let act;

const render = (onClose = jest.fn()) => {
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const AuthModal = require('./AuthModal').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(AuthModal, { onClose })));
  return onClose;
};

const googleBtn = () => document.querySelector('.google-btn');
const click = (el) =>
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

beforeEach(() => {
  document.body.innerHTML = '';
  mockSignInWithGoogle.mockReset().mockResolvedValue();
  require('react-hot-toast').default.error.mockReset();
});

test('구글 버튼 하나만 있고 이메일·비밀번호 입력칸은 없다', () => {
  render();
  expect(googleBtn()).not.toBeNull();
  expect(document.querySelector('input[type="password"]')).toBeNull();
  expect(document.querySelector('input[type="email"]')).toBeNull();
});

test('누르면 구글 로그인을 시작하고 모달이 닫힌다', async () => {
  const onClose = render();

  await act(async () => {
    googleBtn().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('연타해도 한 번만 호출된다', async () => {
  render();
  await act(async () => {
    googleBtn().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    googleBtn().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
});

test('실패하면 한글 안내가 뜨고 버튼이 다시 눌린다', async () => {
  mockSignInWithGoogle.mockRejectedValue(new Error('provider not configured'));
  const onClose = render();

  await act(async () => {
    googleBtn().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const toast = require('react-hot-toast').default;
  expect(toast.error).toHaveBeenCalledWith('구글 로그인이 아직 설정되지 않았어요. 잠시 후 다시 시도해 주세요.');
  expect(onClose).not.toHaveBeenCalled();
  expect(googleBtn().disabled).toBe(false);
});
