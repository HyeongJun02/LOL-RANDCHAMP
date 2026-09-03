import React from 'react';
import { FaRandom, FaUsers, FaBan, FaClipboardList, FaGem, FaTrophy, FaChartBar } from 'react-icons/fa';
import { GiPathDistance, GiCardRandom } from 'react-icons/gi';

/* 도구 추가 = 여기 한 항목. 헤더 nav와 홈 카드가 같이 따라온다.
   category: 'game' 게임 도구 / 'record' 기록
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
    category: 'game',
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
    to: '/scrim-record',
    category: 'record',
    name: '내전 기록지',
    title: '내전 기록지',
    desc: '이긴 팀만 고르면 승패와 내전 포인트가 쌓인다. 팀 짜기 결과도 그대로 가져온다.',
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
    name: '시즌 정산',
    title: '내전 시즌 정산',
    desc: '기간을 잘라 승률과 포인트 순위를 낸다. 이번 달 1등이 누구인지.',
    icon: <FaTrophy />,
    accent: 'gold',
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

/* 홈 화면 분류. 헤더 nav는 READY_TOOLS를 그대로 쓴다 */
export const TOOL_SECTIONS = [
  { key: 'game', label: '게임 도구', tools: READY_TOOLS.filter((t) => t.category === 'game') },
  { key: 'record', label: '기록', tools: READY_TOOLS.filter((t) => t.category === 'record') },
];
