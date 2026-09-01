import React from 'react';
import { FaRandom, FaUsers, FaBan } from 'react-icons/fa';
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
    name: '랜덤 밴픽',
    title: '랜덤 밴픽',
    desc: '밴할 챔피언도 주사위로. 아무도 원망 못 하게.',
    icon: <FaBan />,
    accent: 'red',
  },
  {
    name: '벌칙 룰렛',
    title: '벌칙 룰렛',
    desc: '진 팀이 뭘 할지 정해주는 룰렛. 내기용.',
    icon: <GiCardRandom />,
    accent: 'green',
  },
];

export const READY_TOOLS = TOOLS.filter((t) => t.to);
export const SOON_TOOLS = TOOLS.filter((t) => !t.to);
