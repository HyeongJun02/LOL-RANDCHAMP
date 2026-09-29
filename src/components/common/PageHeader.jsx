import React from 'react';

/* 도구 페이지 공통 타이틀. 크기·여백은 theme.css의 .page-head 계열이 전부 쥐고 있다.
   children은 제목 아래에 붙는 것들(보기 전환 토글 등)

   bar를 주면 제목은 왼쪽, children은 오른쪽 끝으로 간다. 할 일이 있는
   화면('방 만들기' 같은)은 그 버튼이 제목과 같은 줄에 있어야 눈이
   한 번만 움직인다 */
const PageHeader = ({ title, sub, children, bar }) => (
  <header className={`page-head ${bar ? 'is-bar' : ''}`}>
    <div className="page-head-text">
      <h1 className="page-title">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </div>
    {children}
  </header>
);

export default PageHeader;
