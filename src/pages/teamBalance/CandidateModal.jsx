import React, { useEffect } from 'react';
import { FaTimes, FaCheck } from 'react-icons/fa';
import { getTier, tierName } from '../../tiers';

const TeamColumn = ({ team, sum, side }) => (
  <div className={`cand-team ${side}`}>
    <span className="cand-sum">{sum}</span>
    <ul>
      {[...team]
        .sort((a, b) => b.rating - a.rating)
        .map((p) => (
          <li key={p.id} title={tierName(p)}>
            <i style={{ background: getTier(p.tier).color }} />
            {p.name}
          </li>
        ))}
    </ul>
  </div>
);

const CandidateModal = ({ result, onSelect, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const hidden = result.count - result.options.length;

  return (
    <div className="cand-backdrop" onClick={onClose} role="presentation">
      <div
        className="cand-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="가능한 조합"
      >
        <header className="cand-head">
          <h2>
            가능한 조합 <strong>{result.count}</strong>가지
          </h2>
          <p>
            평점 차이가 작은 순. 카드를 누르면 그 조합으로 바꿉니다.
            {hidden > 0 && ` (차이가 큰 ${hidden}가지는 생략)`}
          </p>
          <button className="cand-close" onClick={onClose} aria-label="닫기">
            <FaTimes />
          </button>
        </header>

        <div className="cand-grid">
          {result.options.map((o) => (
            <button
              key={o.id}
              className={`cand-card ${o.id === result.chosenId ? 'is-current' : ''}`}
              onClick={() => onSelect(o)}
            >
              <div className="cand-badge">
                차이 <strong>{o.diff}</strong>
                {o.id === result.chosenId && (
                  <span className="cand-current">
                    <FaCheck /> 현재
                  </span>
                )}
              </div>
              <div className="cand-body">
                <TeamColumn team={o.teamA} sum={o.sumA} side="blue" />
                <span className="cand-vs">VS</span>
                <TeamColumn team={o.teamB} sum={o.sumB} side="red" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CandidateModal;
