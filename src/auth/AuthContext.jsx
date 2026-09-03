import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { neon, isNeonConfigured } from '../neon';
import { setCloudUser } from '../store';

/* Neon Auth의 vanilla 클라이언트는 훅이 아니라 getSession() 비동기 함수라,
   로그인/로그아웃 직후 직접 refresh를 호출해서 우리 쪽 상태를 갱신한다. */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isNeonConfigured);

  const refresh = useCallback(async () => {
    if (!isNeonConfigured) {
      setLoading(false);
      return;
    }
    try {
      const res = await neon.auth.getSession();
      setUser(res?.data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* 로그인하면 저장소들이 Neon을 보게 하고, 로그아웃하면 이 기기 값으로 돌린다.
     세션 확인이 끝나기 전에 부르면 로그인 상태인데도 잠깐 로컬로 떨어진다 */
  useEffect(() => {
    if (loading) return;
    setCloudUser(user?.id ?? null);
  }, [loading, user?.id]);

  /* 구글 로그인은 보통 페이지를 통째로 넘겼다가 callbackURL로 돌아온다.
     돌아오면 AuthProvider가 다시 마운트되면서 refresh()가 돌기 때문에,
     아래 refresh()는 iframe 안에서 팝업으로 처리되는 경우를 위한 것이다.
     callbackURL을 현재 경로로 주어 보던 화면으로 되돌아오게 한다. */
  const signInWithGoogle = async () => {
    const res = await neon.auth.signIn.social({
      provider: 'google',
      callbackURL: window.location.pathname,
    });
    if (res?.error) throw new Error(res.error.message || '구글 로그인에 실패했어요.');
    await refresh();
  };

  const signOut = async () => {
    await neon.auth.signOut();
    await refresh();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, configured: isNeonConfigured, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.');
  return ctx;
};
