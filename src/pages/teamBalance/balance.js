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

   기울기는 감이 아니라 MMR 추정치에서 뽑았다.
   사다리 폭이 아이언4 ~825 MMR ~ 다이아1 ~2175 MMR = 1350 MMR이고,
   평점 스케일(tiers.js)로는 그 구간이 4.75z = 47.5점이다. 즉 1z(10점) ≈ 284 MMR.
   Elo 공식(400점 차 = 10:1)에 넣으면 1z 우위의 1대1 승률이 84%,
   그게 되도록 역산한 값이 14다.
   MMR 추정 출처: leagueoflegendstools.com (커뮤니티 추정치, 라이엇 비공개) */
export const WIN_SCALE = 14;

/* 사람이 한 명 더 있다는 것 자체의 값.
   아이언4의 평점이 0이라고 해서 기여가 0인 건 아니다. 이 값이 없으면
   인원이 다를 때 '평점 높은 한 명'이 '평점 낮은 두 명'보다 세게 나온다.

   ponytail: 12는 5대4(동급 실력)가 81%로 나오게 맞춘 값이다. 실제 4대5는
   더 참혹하지만, 그만큼 올리면 '골드 하나 vs 아이언 둘'이 뒤집힌다.
   하나의 상수로 두 상황을 다 맞출 수는 없어서 내전에서 실제로 나오는
   5대4 쪽에 무게를 뒀다. 인원이 같으면 이 값은 완전히 상쇄된다. */
export const BODY_VALUE = 12;

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
  /* 내전 포인트가 소수라 그대로 두면 3.4000000000000004 같은 값이 화면에 나온다 */
  const diffOf = (sumA) => Math.round(Math.abs(total - 2 * sumA) * 10) / 10;

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
