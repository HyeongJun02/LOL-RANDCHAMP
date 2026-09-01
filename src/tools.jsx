import React from 'react';
import { FaRandom, FaUsers, FaBan, FaClipboardList } from 'react-icons/fa';
import { GiPathDistance, GiCardRandom } from 'react-icons/gi';

/* 도구 추가 = 여기 한 항목. 헤더 nav와 홈 카드가 같이 따라온다.
   `to`가 없으면 아직 준비 중인 도구로 취급된다. */
export const TOOLS = [
  {
    to: '/random-champion',
    name: '챔피언 랜덤',
    title: '챔피언 랜덤 선택',
    desc: '뭐 할지 고민될 땐 그냥 운명에 맡기자. 역할군 필터링도 된다.',
    icon: <FaRandom />,
    accent: 'blue',
  },
  {
    to: '/random-line',
    name: '라인 분배',
    title: '라인 랜덤 분배',
    desc: '가기 싫은 라인은 미리 밴하고, 나머지는 주사위에 맡겨보자.',
    icon: <GiPathDistance />,
    accent: 'gold',
  },
  {
    to: '/team-balance',
    name: '내전 팀 짜기',
    title: '내전 팀 짜기',
    desc: '티어로 평점 매겨서 양 팀이 비슷해지게 갈라준다. 10명 안 채워도 OK.',
    icon: <FaUsers />,
    accent: 'purple',
  },
  {
    to: '/scrim-record',
    name: '내전 기록지',
    title: '내전 기록지',
    desc: '팀을 채우고 이긴 팀을 고르면 승패와 내전 포인트가 쌓인다. 팀 짜기 결과도 그대로 불러온다.',
    icon: <FaClipboardList />,
    accent: 'teal',
    /* 다른 도구와 나란한 그리드 타일이 아니라 홈에서 독자 섹션으로 보여준다 */
    spotlight: true,
  },
  {
    name: '랜덤 밴픽',
    title: '랜덤 밴픽',
    desc: '밴할 챔피언도 주사위로. 아무도 원망 못 하게.',
    icon: <FaBan />,
    accent: 'red',
  },
  {
    to: '/pick',
    name: '랜덤 뽑기',
    title: '랜덤 뽑기',
    desc: '항목 넣고 하나 뽑기. 2개면 동전 던지기, 이름 넣으면 벌칙 당첨자.',
    icon: <GiCardRandom />,
    accent: 'green',
  },
];

export const READY_TOOLS = TOOLS.filter((t) => t.to);
export const SOON_TOOLS = TOOLS.filter((t) => !t.to);

/* 홈 화면 전용 분리: spotlight 도구는 그리드가 아니라 독자 섹션으로 뺀다.
   헤더 nav는 READY_TOOLS를 그대로 쓰므로 영향 없다 */
export const GRID_TOOLS = READY_TOOLS.filter((t) => !t.spotlight);
export const SPOTLIGHT_TOOL = READY_TOOLS.find((t) => t.spotlight);
