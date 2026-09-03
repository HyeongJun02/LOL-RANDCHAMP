/* ------------------------------------------------------------------
   픽 유형 — 라인만으로는 안 잡히는 분류.

   "바텀인데 원딜이 아닌 픽", "정통 서포터가 아닌 근접 서폿" 같은 건
   라이엇 태그(역할군)로도, 라인으로도 표현되지 않는다.

   champLanes.js와 같은 성격의 데이터다. 공식 자료도 픽률 집계도 아니고
   아래 메타에 적힌 모델이 직접 분류했다. 그런데 라인보다 훨씬 빨리 바뀐다 —
   라인은 몇 년 가지만 이런 유행 픽은 패치 몇 번이면 뒤집힌다.
   그래서 특정 패치에서만 반짝한 픽 대신, 오래 통용된 것 위주로만 담았다.

   고치기 쉬우라고 그룹별 배열 하나로 뒀다. 유행이 바뀌면 배열만 손보고
   PICK_META.updatedAt을 같이 올릴 것.
   ------------------------------------------------------------------ */
export const PICK_META = {
  updatedAt: '2026-09-03',
  author: 'Claude Opus 5',
  note: '픽률 집계가 아니라 모델이 직접 분류한 참고 데이터입니다. 라인 분류보다 더 빨리 낡습니다.',
};

export const PICK_GROUPS = [
  {
    key: 'apbot',
    label: '비원딜',
    desc: '원딜 자리에 서는 마법사·전사',
    champions: [
      'Swain', 'Ziggs', 'Seraphine', 'Veigar', 'Karthus', 'Yasuo', 'Yone',
      'Vladimir', 'Cassiopeia', 'Syndra', 'Heimerdinger', 'Velkoz', 'Brand',
    ],
  },
  {
    key: 'oddsup',
    label: '변칙 서폿',
    desc: '카밀·판테온처럼 정통 서포터가 아닌 픽',
    champions: [
      'Camille', 'Pantheon', 'Sett', 'Singed', 'Shaco', 'Poppy', 'Galio',
      'Malphite', 'TahmKench', 'Gragas', 'Zac',
    ],
  },
  {
    key: 'apjungle',
    label: 'AP 정글',
    desc: '마법 피해로 미는 정글러',
    champions: [
      'Elise', 'Evelynn', 'Karthus', 'Fiddlesticks', 'Diana', 'Ekko', 'Nidalee',
      'Lillia', 'Amumu', 'Zac', 'Morgana', 'Brand', 'Taliyah', 'Gragas',
      'Rumble', 'Shyvana', 'Nunu',
    ],
  },
  {
    key: 'rangedtop',
    label: '원거리 탑',
    desc: '견제로 버티는 원거리 탑 라이너',
    champions: ['Kennen', 'Quinn', 'Vayne', 'Teemo', 'Gnar', 'Jayce', 'Heimerdinger', 'Kayle'],
  },
];

const BY_KEY = new Map(PICK_GROUPS.map((g) => [g.key, new Set(g.champions)]));

export const PICK_KEYS = PICK_GROUPS.map((g) => g.key);

/* 이 챔피언이 속한 그룹 키들 */
export const picksOf = (championId) =>
  PICK_GROUPS.filter((g) => BY_KEY.get(g.key).has(championId)).map((g) => g.key);

export const inAnyPick = (championId, keys) =>
  keys.some((k) => BY_KEY.get(k)?.has(championId));
