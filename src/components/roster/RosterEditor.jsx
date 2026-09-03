import React, { useRef } from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { TIERS, DIVISIONS, getTier } from '../../tiers';
import toast from 'react-hot-toast';
import { useRoster, addMember, updateMember, removeMember } from '../../roster';
import { renamePlayer } from '../../matches';
import LineSelector from '../common/LineSelector';

const RosterEditor = () => {
  const roster = useRoster();
  /* 이름은 타이핑마다 바뀌므로, 전적 갈아끼우기는 입력을 끝냈을 때 한 번만 한다 */
  const before = useRef('');

  const finishRename = (name) => {
    const moved = renamePlayer(before.current, name);
    if (moved > 0) {
      toast.success(`내전 기록 ${moved}경기의 이름도 같이 바꿨어요.`);
    }
  };

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
                onFocus={() => {
                  before.current = m.name;
                }}
                onChange={(e) => updateMember(m.id, { name: e.target.value })}
                onBlur={(e) => finishRename(e.target.value)}
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
