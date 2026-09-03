import { useSyncExternalStore } from 'react';

/* 팀원 명단 팝업은 홈 버튼과 헤더 프로필 메뉴 양쪽에서 연다.
   서로 남남인 컴포넌트라 여는 상태를 모듈이 들고 있는다. */
let open = false;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const openRosterModal = () => {
  open = true;
  emit();
};

export const closeRosterModal = () => {
  open = false;
  emit();
};

export const useRosterModalOpen = () => useSyncExternalStore(subscribe, () => open);
