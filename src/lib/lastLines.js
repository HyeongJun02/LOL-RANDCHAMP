/* 라인 정하기에서 마지막으로 다 뽑은 결과. 방의 '일반 게임 또또'가 이걸
   그대로 이어받는다 - 큐 돌리기 전에 라인을 뽑고, 또또 열 때 다섯 명과
   포지션을 다시 손으로 넣는 게 제일 번거로웠다.
   lastSplit.js처럼 단발성 전달이라 읽기/쓰기 함수만 둔다. */
const KEY = 'lrc.lastLines';

/* rows: [{ name, lane }] - lane은 '탑'·'정글' 같은 화면 이름 */
export const saveLastLines = (rows) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ rows, at: Date.now() }));
  } catch {
    /* 저장 못 해도 이번에 못 넘길 뿐이다 */
  }
};

export const loadLastLines = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw && Array.isArray(raw.rows) ? raw : null;
  } catch {
    return null;
  }
};
