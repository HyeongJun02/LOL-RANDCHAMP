import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaGoogle } from 'react-icons/fa';
import Modal from '../common/Modal';
import { useAuth } from '../../auth/AuthContext';
import './AuthModal.css';

/* Neon(Better Auth)이 돌려주는 에러는 영어라 한글 UI 사이에서 튄다.
   구글 provider를 콘솔에서 안 켰을 때가 제일 흔한 실패라 따로 잡아준다. */
const toKoMessage = (raw) => {
  const msg = raw || '';
  if (/provider.*not.*(found|configured|enabled)|unsupported.*provider/i.test(msg)) {
    return '구글 로그인이 아직 설정되지 않았어요. 잠시 후 다시 시도해 주세요.';
  }
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
  }
  if (/popup|closed|cancel/i.test(msg)) {
    return '로그인 창이 닫혔어요.';
  }
  return msg || '로그인에 실패했어요. 다시 시도해 주세요.';
};

const AuthModal = ({ onClose }) => {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  /* busy는 렌더 클로저 값이라 같은 틱에 들어온 두 번째 클릭을 못 막는다.
     ref로 잠가야 연타해도 OAuth 요청이 한 번만 나간다 */
  const running = useRef(false);

  const start = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      toast.error(toKoMessage(err.message));
      running.current = false;
      setBusy(false);
    }
    /* 성공 시엔 보통 구글로 이동해 버리므로 busy를 되돌리지 않는다 */
  };

  return (
    <Modal
      title="로그인"
      desc="다른 기기에서도 같은 팀원 명단·내전 기록을 이어서 쓸 수 있어요."
      onClose={onClose}
      size="modal-sm"
    >
      <button type="button" className="google-btn" onClick={start} disabled={busy}>
        <FaGoogle />
        {busy ? '구글로 이동 중...' : 'Google로 계속하기'}
      </button>

      <p className="auth-note">
        구글 계정으로만 로그인할 수 있어요. 비밀번호를 따로 만들 필요 없습니다.
      </p>
    </Modal>
  );
};

export default AuthModal;
