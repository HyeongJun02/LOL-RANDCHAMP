import React from 'react';

/* 도구 페이지 공통 타이틀. 크기·여백은 theme.css의 .page-head 계열이 전부 쥐고 있다.
   children은 제목 아래에 붙는 것들(보기 전환 토글 등) */
const PageHeader = ({ title, sub, children }) => (
  <header className="page-head">
    <h1 className="page-title">{title}</h1>
    {sub && <p className="page-sub">{sub}</p>}
    {children}
  </header>
);

export default PageHeader;
