import React from 'react';
import { FaCheck } from 'react-icons/fa';
import { getTier, tierName } from '../../tiers';
import Modal from '../../components/common/Modal';

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
  const hidden = result.count - result.options.length;

  return (
    <Modal
      onClose={onClose}
      title={
        <>
          가능한 조합 <strong>{result.count}</strong>가지
        </>
      }
      desc={`평점 차이가 작은 순. 카드를 누르면 그 조합으로 바꿉니다.${
        hidden > 0 ? ` (차이가 큰 ${hidden}가지는 생략)` : ''
      }`}
    >
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
    </Modal>
  );
};

export default CandidateModal;
