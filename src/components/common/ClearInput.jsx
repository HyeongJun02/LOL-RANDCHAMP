import React from 'react';
import { FaTimes } from 'react-icons/fa';

/* 입력칸 안쪽 오른쪽 끝에 붙는 지우기 단추.

   줄 끝의 빨간 ×는 자리(칸)를 통째로 없앤다. 그런데 대개 하고 싶은 건
   '이 사람만 빼고 자리는 그대로 두기'다. 열 칸을 맞춰둔 상태에서 자리가
   사라지면 다시 만들어야 해서 번거롭다. 그래서 둘을 나눠 뒀다.

   부모에 .input-with-clear를 주면 위치가 잡힌다 (theme.css). */
const ClearInput = ({ value, onClear, label = '이름 지우기' }) => {
  if (!String(value ?? '').trim()) return null;
  return (
    <button
      type="button"
      className="clear-in-input"
      onClick={onClear}
      aria-label={label}
      title="이름만 지우기 (자리는 그대로 둡니다)"
    >
      <FaTimes />
    </button>
  );
};

export default ClearInput;
