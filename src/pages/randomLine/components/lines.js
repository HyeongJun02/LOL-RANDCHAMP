// src/pages/randomLine/components/lines.js
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

export const randomQuote = (name) => {
  const line = getLine(name);
  if (!line) return '';
  return line.quotes[Math.floor(Math.random() * line.quotes.length)];
};
