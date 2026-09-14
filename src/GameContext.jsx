import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_GAME, getGame } from './games';

/* 지금 보고 있는 게임.

   티어 목록·디비전 칸 수·라인 유무가 전부 게임에 달려 있는데, 이걸
   props로 내리면 명단 팝업·후보 조합 창처럼 깊이 박힌 컴포넌트까지
   줄줄이 넘겨야 한다. '지금 무슨 게임 화면인가'는 그 화면 전체가
   공유하는 배경이라 컨텍스트가 맞다.

   방 안에서는 방의 게임으로, 로그인 없이 쓰는 도구 페이지에서는
   기본값(롤)으로 돈다. */

const GameContext = createContext(DEFAULT_GAME);

export const GameProvider = ({ game, children }) => (
  <GameContext.Provider value={game || DEFAULT_GAME}>{children}</GameContext.Provider>
);

/* 게임 키만 필요할 때 (순수 함수에 넘길 때) */
export const useGameKey = () => useContext(GameContext);

/* 게임 정의 전체가 필요할 때 (티어 목록 등) */
export const useGame = () => {
  const key = useContext(GameContext);
  return useMemo(() => getGame(key), [key]);
};

export default GameContext;
