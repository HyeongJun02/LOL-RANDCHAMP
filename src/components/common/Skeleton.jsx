import React from 'react';

/* 로딩 중 자리표시. 빈 화면을 두면 멈춘 것처럼 보이고, 스피너 하나만
   돌리면 뭐가 올지 모른다. 올 내용과 같은 모양을 미리 깔아둔다. */

export const SkelLine = ({ w = '100%', h = 14, style }) => (
  <span className="skel" style={{ display: 'block', width: w, height: h, ...style }} />
);

export const SkelBox = ({ h = 64, style }) => (
  <div className="skel" style={{ height: h, borderRadius: 12, ...style }} />
);

/* 줄 목록(명단·로그·순위표)용. count만 바꿔 쓴다 */
export const SkelRows = ({ count = 4, h = 44 }) => (
  <div className="skel-list">
    {Array.from({ length: count }, (_, i) => (
      <SkelBox key={i} h={h} />
    ))}
  </div>
);

/* 왼쪽에 네모 하나, 오른쪽에 두 줄. 방 목록·멤버 목록처럼 '아이콘 +
   이름 + 부제' 모양인 자리에 쓴다. 민민한 막대만 깔면 내용이 들어오는
   순간 줄 높이가 튄다 */
export const SkelList = ({ count = 3, h = 56 }) => (
  <div className="skel-list">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skel-row" style={{ height: h }}>
        <span className="skel skel-row-box" />
        <span className="skel-row-lines">
          <span className="skel" style={{ width: '38%', height: 11 }} />
          <span className="skel" style={{ width: '22%', height: 9 }} />
        </span>
      </div>
    ))}
  </div>
);

export default SkelRows;
