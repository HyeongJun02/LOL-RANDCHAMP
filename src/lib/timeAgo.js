/* 1분 미만은 '방금 전', 그 다음은 분/시간/일 단위로 대충 뭉뚱그린다.
   내전 기록이라 초 단위 정밀도는 필요 없다.

   기록지와 또또가 같은 말을 써야 해서 한 군데 두고 같이 쓴다.
   (rooms.js에 두면 neon 모듈까지 끌려와서 테스트가 못 읽는다) */
export const timeAgo = (ts) => {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
};

export default timeAgo;
