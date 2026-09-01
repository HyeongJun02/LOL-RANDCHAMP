/* 두 팀의 평점 합이 가장 비슷해지는 조합을 찾는다.
   ponytail: 참가자 20명까지 전수 탐색(2^20 = 100만, 10명이면 1024).
   그 이상이 필요해지면 그리디 + 로컬 스왑으로 교체할 것. */
export const MAX_PLAYERS = 20;

/* 팝업에 한 번에 뿌릴 조합 수 상한. 넘어가면 평점 차이가 작은 것부터 자른다 */
export const MAX_OPTIONS = 300;

/* randomness에 이 값을 주면 평점을 완전히 무시하고 뽑는다.
   인원 수(4대4, 3대4)와 팀 고정 조건은 그대로 지켜진다 */
export const IGNORE_RATING = Infinity;

/* 평점 차이를 로지스틱에 넣은 재미용 수치. 실측 승률이 아니다.
   ponytail: 5대5에서 팀 전체가 한 티어 위면 약 66%가 되도록 잡은 상수.
   평점 자체가 랭크 분포 z점수 기반이라(tiers.js) 티어별 간격이 균등하지 않다.
   체감이 다르면 WIN_SCALE만 조정하면 된다. */
export const WIN_SCALE = 24;

/* 사람이 한 명 더 있다는 것 자체의 값.
   아이언4의 평점이 0이라고 해서 기여가 0인 건 아니다. 이 값이 없으면
   인원이 다를 때 '평점 높은 한 명'이 '평점 낮은 두 명'보다 세게 나온다.

   ponytail: 18은 '골드 하나 vs 아이언 둘'이 골드 쪽 약 59%가 되게 맞춘 값이다.
   실제 4대5가 훨씬 참혹하다는 점과는 상충하지만, 이 도구는 5대5 내전이 기본이고
   인원이 같으면 이 값이 상쇄되어 아무 영향이 없다. */
export const BODY_VALUE = 18;

export const winChance = (sumA, sizeA, sumB, sizeB) => {
  if (!sizeA || !sizeB) return 50;

  const strengthA = sumA + sizeA * BODY_VALUE;
  const strengthB = sumB + sizeB * BODY_VALUE;
  /* 인원이 같으면 BODY_VALUE가 상쇄되어 인당 평점 차이 비교와 완전히 같아진다 */
  const scale = WIN_SCALE * ((sizeA + sizeB) / 2);

  const p = 1 / (1 + 10 ** (-(strengthA - strengthB) / scale));
  return Math.round(Math.min(0.95, Math.max(0.05, p)) * 100);
};

/**
 * @param players [{ rating, lock }] lock: 0 자동 / 1 반드시 1팀 / 2 반드시 2팀
 * @param randomness 최적 평점차 대비 허용할 추가 오차. 0이면 항상 최적 조합
 * @returns null이면 인원이 부족하거나 고정 조건이 서로 모순
 */
export const splitTeams = (players, randomness = 0, rng = Math.random) => {
  const n = players.length;
  if (n < 2 || n > MAX_PLAYERS) return null;

  /* 홀수면 4:5처럼 한 명 차이까지 허용 */
  const sizes = n % 2 === 0 ? [n / 2] : [(n - 1) / 2, (n + 1) / 2];
  const total = players.reduce((sum, p) => sum + p.rating, 0);

  /* mask의 i번째 비트가 1이면 i번 참가자는 A팀. 조건 위반이면 -1 */
  const sumIfValid = (mask) => {
    let size = 0;
    let sumA = 0;
    for (let i = 0; i < n; i += 1) {
      const inA = (mask >> i) & 1;
      const { lock } = players[i];
      if (lock === 1 && !inA) return -1;
      if (lock === 2 && inA) return -1;
      if (inA) {
        size += 1;
        sumA += players[i].rating;
      }
    }
    return sizes.includes(size) ? sumA : -1;
  };

  const limit = 1 << n;
  const full = limit - 1;
  const diffOf = (sumA) => Math.abs(total - 2 * sumA);

  /* 유효한 조합을 모은다. 상보 마스크는 1팀/2팀 이름표만 바뀐 같은 조합이므로 한 번만 센다.
     (고정이 걸려 있으면 둘 중 하나만 유효하니 자연히 한 번만 남는다) */
  const diffs = new Map();
  for (let mask = 0; mask < limit; mask += 1) {
    const sumA = sumIfValid(mask);
    if (sumA < 0) continue;
    const twin = full ^ mask;
    if (twin < mask && sumIfValid(twin) >= 0) continue;
    diffs.set(mask, diffOf(sumA));
  }
  if (diffs.size === 0) return null;

  let bestDiff = Infinity;
  diffs.forEach((d) => {
    if (d < bestDiff) bestDiff = d;
  });

  const allowed = bestDiff + randomness;
  const pool = [...diffs.keys()].filter((mask) => diffs.get(mask) <= allowed);
  const chosen = pool[Math.floor(rng() * pool.length)];

  const toOption = (mask) => {
    const teamA = [];
    const teamB = [];
    for (let i = 0; i < n; i += 1) {
      ((mask >> i) & 1 ? teamA : teamB).push(players[i]);
    }
    const sumA = teamA.reduce((sum, p) => sum + p.rating, 0);
    return { id: mask, teamA, teamB, sumA, sumB: total - sumA, diff: diffs.get(mask) };
  };

  const ranked = [...pool].sort((a, b) => diffs.get(a) - diffs.get(b));
  const shown = ranked.slice(0, MAX_OPTIONS);
  if (!shown.includes(chosen)) shown.push(chosen);

  return {
    ...toOption(chosen),
    chosenId: chosen,
    bestDiff,
    count: pool.length,
    options: shown.map(toOption),
  };
};
