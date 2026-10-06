import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/theme.css';
import './index.css';
/* 페이지 JS는 App.js에서 나눠 받지만 CSS는 여기서 전부, 예전 한 덩어리였을 때의
   순서 그대로 싣는다. 페이지 CSS끼리 서로의 클래스를 빌려 쓴다
   (.game-logo는 Rooms.css에 있는데 팀 짜기 · 라인 정하기도 쓴다).
   나눠 받으면 그 페이지에 안 들어간 규칙이 사라지고, 순서가 바뀌면 덮어쓰기가 뒤집힌다.
   새 CSS 파일을 만들면 여기에도 넣을 것 (cssOrder.test.js가 확인한다) */
import './components/common/LineSelector.module.css';
import './components/roster/RosterModal.css';
import './components/auth/AuthModal.css';
import './components/auth/UserMenu.css';
import './components/common/Header/Header.css';
import './components/common/Dialog.css';
import './pages/home/HomePage.css';
import './pages/randomChampion/RandomChampion.css';
import './components/common/RosterPicker.css';
import './pages/randomLine/components/Roulette.module.css';
import './pages/randomLine/components/PlayerCard.module.css';
import './pages/randomLine/components/PlayerRow.module.css';
import './components/common/RosterLoader.css';
import './pages/randomLine/RandomLine.module.css';
import './components/common/ScrimPointsHelp.css';
import './pages/teamBalance/TeamBalance.css';
import './pages/pick/RandomPick.css';
import './components/common/Empty.css';
import './pages/rooms/Rooms.css';
import './pages/scrimRecord/ScrimRecord.css';
import './components/common/RankList.css';
import './pages/season/Season.css';
import './pages/rooms/RoomHome.css';
import './pages/NotFound.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
