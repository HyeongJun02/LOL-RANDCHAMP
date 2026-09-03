import React from 'react';
import { FaUserPlus } from 'react-icons/fa';

/* 저장된 팀원을 불러오는 버튼. 페이지마다 라벨/아이콘/모양이 제각각이면
   같은 기능인지 알기 어려워서 한 컴포넌트로 고정한다.
   아이콘도 RosterPicker(이름 칸 옆 버튼)와 같은 FaUserPlus를 쓴다. */
const RosterLoadButton = ({ onClick, disabled }) => (
  <button
    type="button"
    className="roster-load-btn"
    onClick={onClick}
    disabled={disabled}
    title="저장된 팀원 명단에서 불러오기"
  >
    <FaUserPlus />
    <span>명단 불러오기</span>
  </button>
);

export default RosterLoadButton;
