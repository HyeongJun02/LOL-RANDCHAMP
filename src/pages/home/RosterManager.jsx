import React from 'react';
import { FaPlus, FaTimes, FaUserFriends } from 'react-icons/fa';
import { TIERS, DIVISIONS, getTier } from '../../tiers';
import { useRoster, addMember, updateMember, removeMember } from '../../roster';
import LineSelector from '../../components/common/LineSelector';

const RosterManager = ({ className = '', style }) => {
  const roster = useRoster();

  return (
    <section className={`tool-section ${className}`} style={style}>
      <h2 className="section-title">
        <FaUserFriends /> 내 팀원 명단
        <span className="section-count">{roster.length}</span>
      </h2>
      <p className="roster-desc">
        자주 같이 하는 친구들을 저장해두면, 도구마다 이름 칸 옆의 버튼으로 바로 불러올 수 있어요.
        못 가는 라인까지 저장해두면 라인 분배에서 자동으로 밴됩니다. 이 브라우저에만 저장됩니다.
      </p>

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
    </section>
  );
};

export default RosterManager;
