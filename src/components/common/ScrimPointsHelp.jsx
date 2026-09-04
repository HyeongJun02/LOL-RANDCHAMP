import React from 'react';
import { K_FACTOR, PRIOR_GAMES } from '../../matches';
import './ScrimPointsHelp.css';

/* 점수 규칙 설명. <details>라 여닫는 상태를 따로 들 필요가 없다 */
const ScrimPointsHelp = () => (
  <details className="points-help">
    <summary>내전 포인트는 어떻게 계산되나요?</summary>
    <ul>
      <li>
        <b>상대가 셀수록 많이 오릅니다.</b> 이길 게 뻔했던 승리는 거의 안 오르고,
        질 것 같던 팀을 이기면 크게 오릅니다. 판수만 채워서는 오르지 않습니다.
      </li>
      <li>
        한 판으로 움직이는 폭은 최대 <b>{K_FACTOR}점</b>입니다.
      </li>
      <li>
        <b>판수가 적으면 덜 반영합니다.</b> 2판 2승이 20판 15승보다 위로 가면
        곤란하니, {PRIOR_GAMES}판 정도는 쌓여야 결과를 절반쯤 믿습니다.
      </li>
      <li>칼바람이든 일반이든 한 판은 한 판으로 함께 셉니다.</li>
    </ul>
    <p>
      점수는 저장해두는 게 아니라 기록 전체를 매번 처음부터 다시 계산합니다.
      경기를 지우면 그 경기가 없었던 것처럼 점수가 되돌아갑니다.
    </p>
  </details>
);

export default ScrimPointsHelp;
