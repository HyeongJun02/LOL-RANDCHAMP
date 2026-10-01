import React from 'react';
import { DEFAULT_EMBLEM, glyphsOf } from '../../lib/roomStyle';

/* 방 엠블럼. 고른 이모지일 수도 있고 직접 적은 글자일 수도 있다.

   자리는 어디서나 정사각형으로 고정돼 있는데(방 머리 34px, 방 목록 카드,
   전환 목록...) 'GG'나 '롤캉스' 같은 글자가 들어오면 칸을 뚫고 나간다.
   글자 수를 세어 칸에 맞게 줄인다. 다섯 군데가 같은 셈을 따로 하면
   한 군데만 고쳐지므로 여기 하나로 모은다. */
const Emblem = ({ value, className = '' }) => {
  const text = String(value || '').trim() || DEFAULT_EMBLEM;
  return (
    <span className={`emblem ${className}`} data-glyphs={Math.min(glyphsOf(text), 4)}>
      {text}
    </span>
  );
};

export default Emblem;
