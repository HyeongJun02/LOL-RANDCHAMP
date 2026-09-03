import { useSyncExternalStore } from 'react';
import { neon, isNeonConfigured } from './neon';
import { withinLimit, LIMIT_MESSAGE } from './limits';

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

/* 로그인한 사용자만 서버 용량을 쓴다 */
export const cloudUserId = () => userId;

export const createStore = ({ key, column, hydrate = (x) => x, merge, limitKind }) => {
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

  /* localStorage는 '로그인 안 한 이 기기의 작업 공간'이다.
     로그인 중에 여기에 쓰면, 로그아웃한 뒤 다음 사람이 로그인할 때
     앞사람 데이터가 그 계정으로 딸려 들어간다. 그래서 안 쓴다. */
  const writeLocal = () => {
    if (userId) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* 사파리 프라이빗 모드 등. 이번 세션에서만 유지된다 */
    }
  };

  const push = async () => {
    if (!userId || !isNeonConfigured) return;
    const { error } = await neon.from(TABLE).upsert({
      user_id: userId,
      [column]: state,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  };

  /* 한도를 넘기면 화면 값도 바꾸지 않는다. 넣었다가 서버에서 거절당해
     화면과 서버가 어긋나는 것보다, 애초에 안 넣는 편이 낫다.
     넣었으면 true */
  const commit = (next) => {
    if (limitKind && !withinLimit(limitKind, next.length, userId)) {
      onError(LIMIT_MESSAGE[limitKind]);
      return false;
    }
    state = next;
    writeLocal();
    notify();
    push().catch(() => onError('서버 저장에 실패했어요. 이 기기에는 남아 있습니다.'));
    return true;
  };

  registry.push({
    column,
    get: () => state,
    /* 로그인 직후: 서버 값과 이 기기에 있던 값을 합친다. 어느 쪽도 안 버린다.
       (가입 전에 만들어둔 명단을 계정으로 가져오는 경우) */
    adopt: (remote) => {
      state = merge(readLocal(), hydrate(Array.isArray(remote) ? remote : []));
      notify();
    },
    /* 계정으로 넘긴 뒤에는 이 기기의 익명 데이터를 지운다.
       안 지우면 로그아웃한 다음 사람이 앞사람 기록을 보고,
       그 사람이 로그인하면 자기 계정으로 가져가 버린다 */
    clearLocal: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* 못 지워도 로그인 중에는 안 읽으니 당장 새지는 않는다 */
      }
    },
    /* 로그아웃: 이 기기의 값으로 돌아간다 */
    reset: () => {
      state = readLocal();
      notify();
    },
  });

  /* 다른 탭에서 익명 데이터를 고친 경우. 로그인 중이면 서버가 기준이라 무시한다 */
  window.addEventListener('storage', (e) => {
    if (e.key !== key || userId) return;
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
    const row = { user_id: id, updated_at: new Date().toISOString() };
    registry.forEach((s) => {
      row[s.column] = s.get();
    });
    const res = await neon.from(TABLE).upsert(row);
    if (res.error) throw new Error(res.error.message);

    /* 서버에 확실히 올라간 뒤에만 지운다. 실패했는데 지우면 데이터가 사라진다 */
    registry.forEach((s) => s.clearLocal());
  } catch (e) {
    onError(e.message);
  }
};
