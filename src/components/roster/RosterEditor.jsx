import React from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { TIERS, DIVISIONS, getTier } from '../../tiers';
import { useRoster, addMember, updateMember, removeMember } from '../../roster';
import LineSelector from '../common/LineSelector';

/* 이 명단은 라인 분배·랜덤 뽑기처럼 로그인 없이 쓰는 도구용이다.
   내전 전적은 방이 따로 들고 있어서, 여기서 이름을 바꿔도
   전적을 갈아끼울 일이 없다 (방은 참가자 id로 경기를 남긴다) */
const RosterEditor = () => {
  const roster = useRoster();

  return (
    <>
      <div className="roster-panel">
        {roster.length === 0 && (
          <p className="roster-blank">아직 저장된 팀원이 없어요. 아래 버튼으로 추가하세요.</p>
        )}

        {roster.map((m) => {
          const tier = getTier(m.tier);
          return (
            <div className="member-row" key={m.id}>
              <input
                className="member-name"
                value={m.name}
                placeholder="이름"
                onChange={(e) => updateMember(m.id, { name: e.target.value })}
              />
              <select
                className="member-tier"
                value={m.tier}
                style={{ color: tier.color }}
                onChange={(e) => updateMember(m.id, { tier: e.target.value })}
              >
                {TIERS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="member-div"
                value={m.division}
                disabled={!tier.divisions}
                onChange={(e) => updateMember(m.id, { division: Number(e.target.value) })}
              >
                {tier.divisions ? (
                  DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))
                ) : (
                  <option value={m.division}>-</option>
                )}
              </select>
              <div className="member-lines" title="못 가는 라인">
                <LineSelector
                  compact
                  disabledLines={m.lines || []}
                  onToggle={(line) =>
                    updateMember(m.id, {
                      lines: (m.lines || []).includes(line)
                        ? m.lines.filter((l) => l !== line)
                        : [...(m.lines || []), line],
                    })
                  }
                />
              </div>
              <button
                className="member-del"
                onClick={() => removeMember(m.id)}
                aria-label={`${m.name || '이름 없음'} 삭제`}
              >
                <FaTimes />
              </button>
            </div>
          );
        })}

        <button className="member-add" onClick={() => addMember()}>
          <FaPlus /> 팀원 추가
        </button>
      </div>
    </>
  );
};

export default RosterEditor;
