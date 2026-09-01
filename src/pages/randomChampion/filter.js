/* 역할군은 OR, 검색어는 이름(한글) 또는 영문 id로 매칭. 둘 사이는 AND. */
export const filterChampions = (champions, roles, query) => {
  const q = query.trim().toLowerCase();
  return champions.filter(
    (c) =>
      (roles.length === 0 || c.tags.some((t) => roles.includes(t))) &&
      (q === '' ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q))
  );
};
