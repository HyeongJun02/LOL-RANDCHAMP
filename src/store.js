import { useSyncExternalStore } from 'react';
import { neon, isNeonConfigured } from './neon';

/* localStorage를 기본으로 쓰고, 로그인하면 Neon과 동기화하는 저장소 공장.
   roster.js / matches.js가 이걸 쓴다.

   ponytail: 사용자당 app_state 한 행에 컬럼별 JSON으로 넣는다. 명단도 전적도
   항상 배열째로 읽고 쓰는 데이터라 정규화가 이득이 없다. 전적을 SQL로 집계할
   일이 생기면 그때 matches만 진짜 테이블로 분리할 것.

   쓰기는 낙관적이다. 화면은 즉시 바뀌고 서버 반영은 뒤따라간다. 실패하면
   setSyncErrorHandler로 등록된 콜백이 알린다(모듈이 UI를 몰라야 해서). */
const TABLE = 'app_state';

let userId = null;
const registry = [];
let onError = () => {};

export const setSyncErrorHandler = (fn) => {
  onError = fn;
};

export const createStore = ({ key, column, hydrate = (x) => x, merge }) => {
  const readLocal = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(key));
      return hydrate(Array.isArray(raw) ? raw : []);
    } catch {
      return [];
    }
  };

  let state = readLocal();
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

  const writeLocal = () => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* 사파리 프라이빗 모드 등. 이번 세션에서만 유지된다 */
    }
  };

  const push = async () => {
    if (!userId || !isNeonConfigured) return;
    const { error } = await neon.from(TABLE).upsert({ user_id: userId, [column]: state });
    if (error) throw new Error(error.message);
  };

  const commit = (next) => {
    state = next;
    writeLocal();
    notify();
    push().catch((e) => onError(e.message));
  };

  registry.push({
    column,
    get: () => state,
    /* 로그인 직후: 서버 값과 이 기기에 있던 값을 합친다. 어느 쪽도 안 버린다 */
    adopt: (remote) => {
      state = merge(readLocal(), hydrate(Array.isArray(remote) ? remote : []));
      writeLocal();
      notify();
    },
    /* 로그아웃: 이 기기의 값으로 돌아간다 */
    reset: () => {
      state = readLocal();
      notify();
    },
  });

  window.addEventListener('storage', (e) => {
    if (e.key !== key) return;
    state = readLocal();
    notify();
  });

  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  /* 훅 규칙 린트가 이름으로 훅을 판별한다. use로 시작하는 이름이어야 통과 */
  const useValue = () => useSyncExternalStore(subscribe, () => state);

  return { use: useValue, get: () => state, commit };
};

/* AuthContext가 로그인/로그아웃 시 호출한다 */
export const setCloudUser = async (id) => {
  userId = id;

  if (!id || !isNeonConfigured) {
    registry.forEach((s) => s.reset());
    return;
  }

  try {
    const { data, error } = await neon
      .from(TABLE)
      .select('*')
      .eq('user_id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    registry.forEach((s) => s.adopt(data?.[s.column]));

    /* 합친 결과를 한 번에 밀어 넣는다 */
    const row = { user_id: id };
    registry.forEach((s) => {
      row[s.column] = s.get();
    });
    const res = await neon.from(TABLE).upsert(row);
    if (res.error) throw new Error(res.error.message);
  } catch (e) {
    onError(e.message);
  }
};
