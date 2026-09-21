/* '연출 건너뛰기'는 도구마다 따로 켜야 할 이유가 없다.
   한 번 끄면 챔피언 랜덤이든 랜덤 뽑기든 같이 적용된다. */
const KEY = 'lrc.skipAnim';

export const readSkipAnim = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const writeSkipAnim = (on) => {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* 저장 못 해도 이번 세션에선 동작한다 */
  }
};
