import React, { useMemo, useState } from 'react';
import { useRoster } from '../../roster';
import { useMatches, gameCountsOf } from '../../matches';
import { getTier, tierName, ratingOf } from '../../tiers';
import Modal from './Modal';
import './RosterLoader.css';

const SORTS = [
  { value: 'name', label: '이름순' },
  { value: 'tier', label: '티어순' },
  { value: 'games', label: '내전순' },
];

/* 저장된 팀원을 체크해서 참가자 목록을 통째로 맞춘다.
   체크를 풀면 이미 들어가 있던 사람도 빠진다.
   present: 지금 참가자로 들어가 있는 이름들
   limit:   명단에서 채울 수 있는 최대 인원 (없으면 무제한) */
const RosterLoader = ({ present = [], limit, onConfirm, onClose }) => {
  const roster = useRoster();
  const matches = useMatches();
  const presentNames = new Set(present.map((n) => n.trim()).filter(Boolean));

  const [sort, setSort] = useState('name');
  const [picked, setPicked] = useState(() =>
    roster.filter((m) => presentNames.has(m.name.trim())).map((m) => m.id)
  );

  const counts = useMemo(() => gameCountsOf(matches), [matches]);

  /* 정렬은 보이는 순서만 바꾼다. '위에서 N명 선택'도 이 순서를 따른다 */
  const sorted = useMemo(() => {
    const byName = (a, b) => a.name.localeCompare(b.name, 'ko');
    const list = [...roster];
    if (sort === 'tier') {
      return list.sort((a, b) => ratingOf(b) - ratingOf(a) || byName(a, b));
    }
    if (sort === 'games') {
      const of = (m) => counts.get(m.name.trim()) || 0;
      return list.sort((a, b) => of(b) - of(a) || byName(a, b));
    }
    return list.sort(byName);
  }, [roster, sort, counts]);

  const atLimit = limit !== undefined && picked.length >= limit;

  const toggle = (id) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /* 자리가 모자라면 보이는 순서대로 위에서부터 채운다 */
  const selectable = Math.min(limit ?? sorted.length, sorted.length);
  const allSelected = selectable > 0 && picked.length >= selectable;
  const selectAll = () =>
    setPicked(allSelected ? [] : sorted.slice(0, selectable).map((m) => m.id));

  const confirm = () => {
    onConfirm(roster.filter((m) => picked.includes(m.id)));
    onClose();
  };

  return (
    <Modal
      title="명단 불러오기"
      desc={
        limit === undefined
          ? '체크한 팀원이 참가자가 됩니다. 체크를 풀면 빠집니다.'
          : `체크한 팀원이 참가자가 됩니다. 체크를 풀면 빠집니다. 최대 ${limit}명.`
      }
      onClose={onClose}
      size="modal-sm"
      footer={
        <>
          <span className="loader-count">
            {picked.length > 0 ? `${picked.length}명 선택` : '선택 없음'}
          </span>
          <button className="ghost-btn" onClick={onClose}>
            취소
          </button>
          <button className="loader-confirm" onClick={confirm}>
            완료
          </button>
        </>
      }
    >
      {roster.length === 0 ? (
        <p className="loader-blank">
          저장된 팀원이 없습니다. 홈 화면의 &lsquo;내 팀원 명단&rsquo;에서 먼저 추가하세요.
        </p>
      ) : (
        <>
          <div className="loader-sort">
            <div className="seg-tabs">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  className={`seg-tab ${sort === s.value ? 'active' : ''}`}
                  onClick={() => setSort(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button className="loader-all" onClick={selectAll}>
              {allSelected
                ? '전체 해제'
                : selectable < sorted.length
                  ? `위에서 ${selectable}명`
                  : '전체 선택'}
            </button>
          </div>

          <ul className="loader-list">
            {sorted.map((m) => {
              const checked = picked.includes(m.id);
              const games = counts.get(m.name.trim()) || 0;
              return (
                <li key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={atLimit && !checked}
                      onChange={() => toggle(m.id)}
                    />
                    <span className="loader-name">{m.name || '(이름 없음)'}</span>
                    <span
                      className="loader-tier"
                      style={{ '--tier': getTier(m.tier).color }}
                    >
                      {tierName(m)}
                    </span>
                    {sort === 'games' && games > 0 && (
                      <span className="loader-lines">내전 {games}판</span>
                    )}
                    {presentNames.has(m.name.trim()) && (
                      <span className="loader-added">참가 중</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
};

export default RosterLoader;
