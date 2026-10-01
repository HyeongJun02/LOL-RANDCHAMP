import React from 'react';
import { laneIcon, laneLabel } from '../../rules/casual';

/* 라인 표시. 아이콘만 두면 서폿·원딜을 헷갈리는 사람이 있어서 글자를 같이
   붙인다. prefix는 '상대 ' 같은 앞말 */
const LaneTag = ({ lane, prefix = '', className = '' }) =>
  lane ? (
    <span className={`lane-tag ${className}`}>
      <img src={laneIcon(lane)} alt="" />
      {prefix}
      {laneLabel(lane)}
    </span>
  ) : null;

export default LaneTag;
