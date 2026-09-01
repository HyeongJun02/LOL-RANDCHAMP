import React from 'react';

/* 앱 전역 배경 데코. position:fixed라 헤더 뒤까지 깔린다.
   페이지 컨테이너는 배경색 없이 투명하게 두어야 보인다. */
const Backdrop = () => (
  <>
    <div className="gg-aurora" aria-hidden="true">
      <span className="gg-blob gg-blob-gold gg-blob-1" />
      <span className="gg-blob gg-blob-blue gg-blob-2" />
      <span className="gg-blob gg-blob-purple gg-blob-3" />
    </div>
    <div className="gg-hexbg" aria-hidden="true" />
    <div className="gg-grain" aria-hidden="true" />
  </>
);

export default Backdrop;
