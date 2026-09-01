/* 줄바꿈이나 쉼표로 끊어 항목을 만든다. 앞뒤 공백과 빈 줄, 중복은 버린다.
   (붙여넣기로 한 번에 여러 개 넣는 경우가 대부분이라 파싱이 필요하다) */
export const parseItems = (text) => [
  ...new Set(
    String(text)
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
  ),
];

export const addItems = (items, text) => [...new Set([...items, ...parseItems(text)])];

/* '뽑은 항목 제외'가 켜져 있으면 이미 나온 건 후보에서 뺀다 */
export const poolOf = (items, drawn, exclude) =>
  exclude ? items.filter((i) => !drawn.includes(i)) : items;
