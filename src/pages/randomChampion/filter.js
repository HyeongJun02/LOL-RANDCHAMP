import { lanesOf } from '../../champLanes';

/* 역할군끼리 OR, 라인끼리 OR, 검색어는 이름(한글) 또는 영문 id.
   세 조건 사이는 AND.
   라인 표에 없는 챔피언은 라인 필터가 걸리면 빠진다 (추측으로 채우지 않는다) */
export const filterChampions = (champions, roles, query, lanes = []) => {
  const q = query.trim().toLowerCase();
  return champions.filter(
    (c) =>
      (roles.length === 0 || c.tags.some((t) => roles.includes(t))) &&
      (lanes.length === 0 || lanesOf(c.id).some((l) => lanes.includes(l))) &&
      (q === '' ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q))
  );
};
