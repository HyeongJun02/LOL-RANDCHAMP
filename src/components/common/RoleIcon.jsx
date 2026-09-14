import React from 'react';

/* 라인·역할 아이콘.

   롤 라인 아이콘은 금색이 칠해진 그림 파일이라 그대로 <img>로 띄운다.
   발로란트 역할군 아이콘은 단색(#ECE8E1) SVG라, 그대로 두면 넷이 다 같은
   흰색으로 보인다. 마스크로 떠서 역할 색을 입힌다.

   색은 currentColor를 쓴다. 그래야 '평소엔 흐리게, 고르면 제 색으로' 같은
   기존 hover 규칙을 CSS에서 그대로 얹을 수 있다. */
const RoleIcon = ({ role, className = '', size, style }) => {
  if (!role) return null;

  const box = { ...(size ? { width: size, height: size } : null), ...style };

  if (!role.mono) {
    return <img src={role.icon} alt="" className={className} style={box} />;
  }

  return (
    <span
      className={`role-icon ${className}`}
      /* 파일 이름이 한글이라 그대로 넣으면 url()이 깨진다 */
      style={{ ...box, '--mask': `url("${encodeURI(role.icon)}")` }}
      aria-hidden="true"
    />
  );
};

export default RoleIcon;
