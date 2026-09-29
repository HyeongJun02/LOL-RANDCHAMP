import React from 'react';
import './Empty.css';

/* 아무것도 없는 화면.

   한 줄짜리 회색 글씨로 두면 '없다'는 사실만 전하고 끝난다. 처음 들어온
   사람은 거기서 멈춘다 - 없다는 건 알겠는데 그래서 뭘 해야 하는지가 없다.

   그림 하나, 제목 한 줄, 다음에 할 일 한 줄. 할 게 있으면 버튼까지.
   빈 화면이야말로 제일 자주 보는 화면이라 제대로 세워둘 값어치가 있다. */
const Empty = ({ icon, title, desc, action }) => (
  <div className="empty">
    {icon && <span className="empty-icon">{icon}</span>}
    <strong className="empty-title">{title}</strong>
    {desc && <p className="empty-desc">{desc}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>
);

export default Empty;
