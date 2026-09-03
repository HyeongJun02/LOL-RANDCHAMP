/* 뽑기 연출 타이밍.

   고정 간격으로 깜빡이면 "빠르게 바뀌는 이미지"로만 보인다.
   실제 룰렛처럼 처음엔 촘촘하게 돌다가 끝으로 갈수록 느려져야
   마지막 두세 장이 눈에 들어오면서 뽑히는 맛이 난다. */
export const ROLL_MS = 1600;

const FAST = 45; // 시작 간격
const SLOW = 320; // 끝날 무렵 간격

/* progress 0 → 1. 세제곱이라 초반은 거의 안 느려지다가 끝에서 확 늘어진다 */
export const rollDelay = (progress) => {
  const p = Math.min(1, Math.max(0, progress));
  return FAST + (SLOW - FAST) * p * p * p;
};
