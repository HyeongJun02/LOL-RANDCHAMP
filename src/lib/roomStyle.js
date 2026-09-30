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

/* 눌러서 고르는 엠블럼. 직접 적을 수도 있다 (아래 EMBLEM_MAX) */
export const EMBLEMS = [
  '⚔️', '🛡️', '👑', '🔥', '⚡', '🐉',
  '🦁', '🐺', '🦈', '🍺', '🎯', '💀',
  '🌙', '⭐', '🍀', '🎮',
];

export const DEFAULT_EMBLEM = '⚔️';

/* 직접 적을 때 몇 글자까지. 자리가 정사각형이라 네 글자부터는 읽을 수
   없을 만큼 작아진다 */
export const EMBLEM_MAX = 3;

/* 사람이 세는 '글자 수'. '⚔️'는 코드로는 둘이고 '👨‍👩‍👧'는 다섯이라,
   문자열 길이로 세면 이모지 하나가 세 글자 취급을 받는다 */
export const glyphsOf = (text) => {
  const s = String(text || '');
  try {
    return [...new Intl.Segmenter().segment(s)].length;
  } catch {
    /* Segmenter가 없는 브라우저. 코드 포인트로라도 센다 */
    return [...s].length;
  }
};

/* DB의 rooms_emblem_chk가 코드 여덟 개까지만 받는다. 이모지 하나가
   코드 다섯을 먹기도 해서, 글자 수와 따로 이쪽도 지켜야 한다 */
const CODE_MAX = 8;

/* 앞에서부터 EMBLEM_MAX 글자만 남긴다. maxLength로는 이모지가 중간에
   잘려서 깨진 글자가 된다.
   길이 제한에 걸리면 뒤에서부터 한 글자씩 뺀다 - 화면에서 통과시킨 값이
   서버에서 거절당하면 사람은 왜 안 되는지 모른다 */
export const clipEmblem = (text) => {
  const clean = String(text || '').replace(/\s+/g, '');
  let parts;
  try {
    parts = [...new Intl.Segmenter().segment(clean)].map((x) => x.segment);
  } catch {
    parts = [...clean];
  }
  parts = parts.slice(0, EMBLEM_MAX);
  while (parts.length > 1 && [...parts.join('')].length > CODE_MAX) parts.pop();
  const out = parts.join('');
  return [...out].length > CODE_MAX ? '' : out;
};

export const accentOf = (key) =>
  ACCENTS.find((a) => a.key === key) || ACCENTS.find((a) => a.key === DEFAULT_ACCENT);

/* 방 화면 맨 바깥에 붙일 CSS 변수. 테두리·배지·버튼이 전부 이걸 본다.
   --accent는 원래 도구 페이지들이 쓰던 이름이라 그대로 얹으면
   기존 컴포넌트도 같이 물든다 */
export const accentVars = (key) => {
  const a = accentOf(key);
  return { '--accent': a.main, '--accent-light': a.light };
};
