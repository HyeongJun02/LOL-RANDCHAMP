import React from 'react';
import { FaRandom, FaUsers, FaBan, FaClipboardList, FaGem, FaChartBar } from 'react-icons/fa';
import { GiPathDistance, GiCardRandom } from 'react-icons/gi';

/* 도구 추가 = 여기 한 항목. 헤더 nav와 홈 카드가 같이 따라온다.
   category: 'game' 게임 도구 / 'scrim' 내전
   `to`가 없으면 아직 준비 중인 도구다 (category는 무시된다). */
export const TOOLS = [
  {
    to: '/random-champion',
    category: 'game',
    name: '챔피언 랜덤',
    title: '챔피언 랜덤 선택',
    desc: '뭐 할지 고민되면 주사위한테 맡긴다. 역할군이나 라인으로 걸러서 뽑을 수도 있다.',
    icon: <FaRandom />,
    accent: 'blue',
  },
  {
    to: '/random-line',
    category: 'game',
    name: '라인 분배',
    title: '라인 랜덤 분배',
    desc: '가기 싫은 라인은 미리 밴하고, 나머지는 랜덤으로 배정한다.',
    icon: <GiPathDistance />,
    accent: 'gold',
  },
  {
    to: '/team-balance',
    category: 'scrim',
    name: '내전 팀 짜기',
    title: '내전 팀 짜기',
    desc: '티어로 평점을 매겨 양 팀을 비슷하게 가른다. 10명 안 채워도 된다.',
    icon: <FaUsers />,
    accent: 'purple',
  },
  {
    to: '/pick',
    category: 'game',
    name: '랜덤 뽑기',
    title: '랜덤 뽑기',
    desc: '항목 넣고 하나 뽑는다. 2개만 넣으면 동전 던지기, 이름을 넣으면 벌칙 당첨자.',
    icon: <GiCardRandom />,
    accent: 'green',
  },
  {
    to: '/rooms',
    category: 'scrim',
    primary: true,
    name: '내전 방',
    title: '내전 방',
    desc: '같이 하는 사람들끼리 방을 만든다. 팀 짜기·기록·또또·정산이 전부 방 안에 있다.',
    icon: <FaClipboardList />,
    accent: 'teal',
  },

  /* ---------- 준비 중 ---------- */
  {
    name: '랜덤 밴픽',
    title: '랜덤 밴픽',
    desc: '밴할 챔피언도 주사위로 정한다. 아무도 원망 못 하게.',
    icon: <FaBan />,
    accent: 'red',
  },
  {
    name: '랜덤 아이템',
    title: '랜덤 아이템 빌드',
    desc: '아이템 여섯 칸을 통째로 뽑는다. 이걸로 이겨보라는 벌칙용.',
    icon: <FaGem />,
    accent: 'blue',
  },
  {
    name: '챔피언 전적',
    title: '챔피언별 내전 전적',
    desc: '누가 뭘 해서 이겼는지 쌓아둔다. 내전 OP도, 지뢰도 드러난다.',
    icon: <FaChartBar />,
    accent: 'purple',
  },
];

export const READY_TOOLS = TOOLS.filter((t) => t.to);
export const SOON_TOOLS = TOOLS.filter((t) => !t.to);

/* 홈 화면 분류. 헤더 nav도 이 순서를 그대로 따른다.
   내전이 먼저다 - 이 사이트에 오는 이유는 내전이고, 게임 도구는
   내전하다가 곁들이는 것들이다 */
export const TOOL_SECTIONS = [
  {
    key: 'scrim',
    label: '내전',
    hint: '방을 만들면 팀 짜기부터 기록·정산까지 한곳에서 됩니다',
    /* 대표 도구(내전 방)가 맨 앞. 팀 짜기는 그 방 안에서도 쓸 수 있는 곁길이다 */
    tools: READY_TOOLS.filter((t) => t.category === 'scrim').sort(
      (a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0)
    ),
  },
  {
    key: 'game',
    label: '게임 도구',
    hint: '정하기 귀찮은 것들을 주사위한테 맡깁니다',
    tools: READY_TOOLS.filter((t) => t.category === 'game'),
  },
];
