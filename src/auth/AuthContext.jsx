import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { neon, isNeonConfigured } from '../neon';

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

  const signUp = async ({ email, password, name }) => {
    const res = await neon.auth.signUp.email({ email, password, name });
    if (res?.error) throw new Error(res.error.message || '회원가입에 실패했어요.');
    await refresh();
  };

  const signIn = async ({ email, password }) => {
    const res = await neon.auth.signIn.email({ email, password });
    if (res?.error) throw new Error(res.error.message || '로그인에 실패했어요.');
    await refresh();
  };

  const signOut = async () => {
    await neon.auth.signOut();
    await refresh();
  };

  return (
    <AuthContext.Provider value={{ user, loading, configured: isNeonConfigured, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.');
  return ctx;
};
