import React from 'react';
import { FaCheck } from 'react-icons/fa';

/* 체크 토글 하나. 명단 불러오기의 그 모양을 전 화면 공용으로 뺀 것.
   기본 <input type="checkbox">는 브라우저 기본 스타일이 그대로 나와서
   방·설정 화면에서 유독 튀었다.

   실제 input은 숨겨두고(접근성·키보드는 그대로) 네모는 우리가 그린다. */
const Check = ({ checked, onChange, disabled = false, children, className = '' }) => (
  <label
    className={`check-row ${checked ? 'is-on' : ''} ${disabled ? 'is-off' : ''} ${className}`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="check-box" aria-hidden="true">
      {checked && <FaCheck />}
    </span>
    {children}
  </label>
);

export default Check;
