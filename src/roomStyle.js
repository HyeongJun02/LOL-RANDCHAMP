/* 방 색과 엠블럼.

   방마다 강조색이 다르면 들어오는 순간 '우리 방'이 된다. 색은 키로만
   저장하고(DB의 rooms_accent_chk가 목록을 강제한다) 실제 값은 여기서
   정한다. 임의의 CSS 값을 DB에 넣을 수 있으면 그걸로 화면을 망가뜨릴 수 있다. */

export const ACCENTS = [
  { key: 'gold', label: '금색', main: '#c8aa6e', light: '#e7c98a' },
  { key: 'blue', label: '푸른색', main: '#38bdf8', light: '#7dd3fc' },
  { key: 'green', label: '초록색', main: '#4ade80', light: '#86efac' },
  { key: 'purple', label: '보라색', main: '#c084fc', light: '#d8b4fe' },
  { key: 'red', label: '붉은색', main: '#f97362', light: '#fca5a5' },
  { key: 'cyan', label: '청록색', main: '#2dd4bf', light: '#5eead4' },
];

export const DEFAULT_ACCENT = 'gold';

/* 고를 수 있는 엠블럼. 직접 입력을 열어두면 아무 글자나 들어와서
   줄이 밀린다. 눌러서 고르는 편이 빠르기도 하다 */
export const EMBLEMS = [
  '⚔️', '🛡️', '👑', '🔥', '⚡', '🐉',
  '🦁', '🐺', '🦈', '🍺', '🎯', '💀',
  '🌙', '⭐', '🍀', '🎮',
];

export const DEFAULT_EMBLEM = '⚔️';

export const accentOf = (key) =>
  ACCENTS.find((a) => a.key === key) || ACCENTS.find((a) => a.key === DEFAULT_ACCENT);

/* 방 화면 맨 바깥에 붙일 CSS 변수. 테두리·배지·버튼이 전부 이걸 본다.
   --accent는 원래 도구 페이지들이 쓰던 이름이라 그대로 얹으면
   기존 컴포넌트도 같이 물든다 */
export const accentVars = (key) => {
  const a = accentOf(key);
  return { '--accent': a.main, '--accent-light': a.light };
};
