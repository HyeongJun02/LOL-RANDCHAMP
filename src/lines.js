export const LINES = [
  {
    name: '탑',
    icon: '/line_icon/top_gold.svg',
    color: '#f97362',
    glow: 'rgba(249, 115, 98, 0.55)',
    quotes: [
      '혼자 다 캐리해라 🗿',
      '스플릿 각 보는 중',
      '탑차이는 국룰이지',
      '1:1 안 지면 반은 이김',
      '억울하면 이겨라',
    ],
  },
  {
    name: '정글',
    icon: '/line_icon/jungle_gold.svg',
    color: '#4ade80',
    glow: 'rgba(74, 222, 128, 0.55)',
    quotes: [
      '전부 다 니 탓이다 🍃',
      '갱 안 온다고 욕 먹을 각',
      '스맵만 봐도 반은 함',
      '캠프 다 내꺼',
      '탓 담당 확정',
    ],
  },
  {
    name: '미드',
    icon: '/line_icon/mid_gold.svg',
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.55)',
    quotes: [
      '관종 라인 등장 ✨',
      'CS 밀리면 바로 탓 들어옴',
      '로밍 각만 보는 중',
      '스포트라이트는 내꺼',
      '1인분 아니면 12인분',
    ],
  },
  {
    name: '원딜',
    icon: '/line_icon/adc_gold.webp',
    color: '#fde047',
    glow: 'rgba(253, 224, 71, 0.55)',
    quotes: [
      '버스 좌석 예약 완료 🚌',
      '포지셔닝이 생명',
      '한타 전까지는 숨만 쉼',
      '딜은 내가 넣는다',
      '킬 스틸 주의보',
    ],
  },
  {
    name: '서폿',
    icon: '/line_icon/support_gold.svg',
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.55)',
    quotes: [
      '콜은 내가 한다 📢',
      '시야 장인 등판',
      '와드 값만 30만원',
      '고맙다는 말은 안 바람',
      '헌신하는 자, 그것이 서폿',
    ],
  },
];

export const LINE_NAMES = LINES.map((l) => l.name);

export const getLine = (name) => LINES.find((l) => l.name === name);

/* 롤 라인과 발로 역할군을 다 뒤진다. 이름이 겹치지 않아서 한 번에 찾는다 */
const ALL_ROLES = () => [...LINES, ...VALORANT_ROLES];

export const randomQuote = (name) => {
  const role = ALL_ROLES().find((r) => r.name === name);
  if (!role) return '';
  return role.quotes[Math.floor(Math.random() * role.quotes.length)];
};

/* ------------------------------------------------------------------
   발로란트 역할군.

   롤은 다섯 라인을 다섯 명이 하나씩 나눠 갖지만, 발로란트는 역할이 넷이라
   5인 팀이면 하나는 겹친다. 그래서 '겹쳐도 되는' 역할이다.

   한국 서버 공식 명칭을 쓴다. 전략가를 흔히 '연막'이라 부르는데,
   그 말이 더 빨리 통해서 설명에 같이 적어둔다.
   ------------------------------------------------------------------ */
export const VALORANT_ROLES = [
  {
    name: '타격대',
    emoji: '⚔️',
    hint: '듀얼리스트 · 앞라인',
    color: '#ff4655',
    glow: 'rgba(255, 70, 85, 0.55)',
    quotes: [
      '앞은 내가 연다 ⚔️',
      '엔트리 못 따면 욕먹는 자리',
      '첫 킬은 내꺼',
      '죽어도 정보는 주고 죽는다',
      '대쉬 쓰고 생각하기',
    ],
  },
  {
    name: '척후대',
    emoji: '🛰️',
    hint: '이니시에이터 · 정보',
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.55)',
    quotes: [
      '정보 다 뽑아준다 🛰️',
      '플래시 터지면 바로 들어가',
      '어디 있는지 다 보임',
      '내 화살 믿고 들어가라',
      '콜 안 들으면 화남',
    ],
  },
  {
    name: '감시자',
    emoji: '🛡️',
    hint: '센티널 · 수비',
    color: '#4ade80',
    glow: 'rgba(74, 222, 128, 0.55)',
    quotes: [
      '뒤는 내가 본다 🛡️',
      '여긴 못 넘어옴',
      '설치물 값만 얼마야',
      '혼자 사이트 지키는 중',
      '해체는 내가 할게',
    ],
  },
  {
    name: '전략가',
    emoji: '🌫️',
    hint: '컨트롤러 · 연막',
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.55)',
    quotes: [
      '연막 깔아줄게 🌫️',
      '스모크 없으면 진입 못 함',
      '시야 지우는 담당',
      '연막 위치로 싸우지 말자',
      '안 보이면 못 쏨',
    ],
  },
];
