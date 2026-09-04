import React from 'react';
import { Link } from 'react-router-dom';
import { FaDice, FaHome } from 'react-icons/fa';
import { READY_TOOLS } from '../tools';
import './NotFound.css';

/* 없는 주소로 들어왔을 때.

   주소를 잘못 친 경우도 있지만, 방이 삭제됐거나 링크가 오래된 경우가
   더 많다. 그래서 '없다'로 끝내지 않고 갈 만한 곳을 같이 놓는다. */
const NotFound = () => (
  <div className="page nf-page">
    <FaDice className="nf-dice" />
    <h1 className="nf-code">404</h1>
    <p className="nf-title">여기엔 아무것도 없어요</p>
    <p className="nf-desc">
      주소가 잘못됐거나, 지워진 방일 수 있어요.
      <br />
      아래에서 가려던 곳을 골라보세요.
    </p>

    <Link className="nf-home" to="/">
      <FaHome /> 홈으로
    </Link>

    <div className="nf-links">
      {READY_TOOLS.map((t) => (
        <Link key={t.to} to={t.to} className={`nf-link accent-${t.accent}`}>
          <span className="nf-link-icon">{t.icon}</span>
          {t.name}
        </Link>
      ))}
    </div>
  </div>
);

export default NotFound;
