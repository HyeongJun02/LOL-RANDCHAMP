import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { useAuth } from '../../auth/AuthContext';
import './AuthModal.css';

/* Neon(Better Auth)이 돌려주는 에러 메시지는 영어라 한글 UI 사이에서 튄다.
   "invalid email"류 문구는 회원가입/로그인 중 뭘 하고 있었는지에 따라 뜻이
   갈린다 — 가입 중이면 이메일 형식 문제, 로그인 중이면 자격 증명 불일치일
   가능성이 높다. 정규식 우선순위로 이 둘을 구분하려 하면 서로의 문구를
   가로채기 쉬워서, 어느 흐름이었는지(mode)를 직접 넘겨받아 구분한다. */
const toKoMessage = (raw, mode) => {
  const msg = raw || '';
  if (/user.*already.*exist|email.*already.*(registered|exist|use)/i.test(msg)) {
    return '이미 가입된 이메일이에요.';
  }
  if (/password.*(short|length|least)/i.test(msg)) {
    return '비밀번호는 8자 이상이어야 해요.';
  }
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
  }
  if (/invalid|incorrect|wrong/i.test(msg)) {
    return mode === 'signup' ? '이메일 형식을 확인해 주세요.' : '이메일 또는 비밀번호가 맞지 않아요.';
  }
  return msg || '문제가 생겼어요. 다시 시도해 주세요.';
};

const blankForm = { name: '', email: '', password: '', confirm: '' };

const AuthModal = ({ onClose }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  /* 모드를 바꾸면 비밀번호류는 지운다 — 실수로 다른 흐름에 그대로 남아있으면 안 되니까 */
  const switchMode = (next) => {
    if (busy || next === mode) return;
    setMode(next);
    setForm((prev) => ({ ...prev, password: '', confirm: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    const email = form.email.trim();
    const name = form.name.trim();

    if (mode === 'signup' && form.password !== form.confirm) {
      toast.error('비밀번호가 서로 달라요.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp({ email, password: form.password, name: name || email.split('@')[0] });
        toast.success('회원가입 완료! 자동으로 로그인됐어요.');
      } else {
        await signIn({ email, password: form.password });
        toast.success('로그인했어요.');
      }
      onClose();
    } catch (err) {
      toast.error(toKoMessage(err.message, mode));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={mode === 'signup' ? '회원가입' : '로그인'}
      desc="다른 기기에서도 같은 팀원 명단·내전 기록을 이어서 쓸 수 있어요."
      onClose={onClose}
      size="modal-sm"
    >
      <div className="seg-tabs auth-tabs">
        <button
          type="button"
          className={`seg-tab ${mode === 'signin' ? 'active' : ''}`}
          onClick={() => switchMode('signin')}
          disabled={busy}
        >
          로그인
        </button>
        <button
          type="button"
          className={`seg-tab ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => switchMode('signup')}
          disabled={busy}
        >
          회원가입
        </button>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && (
          <label className="auth-field">
            <span>닉네임</span>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="비워두면 이메일 앞부분을 써요"
              autoComplete="nickname"
              disabled={busy}
            />
          </label>
        )}

        <label className="auth-field">
          <span>이메일</span>
          <input
            type="email"
            required
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            disabled={busy}
          />
        </label>

        <label className="auth-field">
          <span>비밀번호</span>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            disabled={busy}
          />
          {mode === 'signup' && <em className="auth-hint">영문·숫자 포함 8자 이상</em>}
        </label>

        {mode === 'signup' && (
          <label className="auth-field">
            <span>비밀번호 확인</span>
            <input
              type="password"
              required
              minLength={8}
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
        )}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? '처리 중...' : mode === 'signup' ? '가입하고 시작하기' : '로그인'}
        </button>
      </form>
    </Modal>
  );
};

export default AuthModal;
