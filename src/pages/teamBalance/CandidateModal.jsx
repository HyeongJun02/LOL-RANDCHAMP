import React from 'react';
import { FaCheck } from 'react-icons/fa';
import { getTier, tierName } from '../../rules/games';
import { useGameKey } from '../../lib/GameContext';
import Modal from '../../components/common/Modal';

const TeamColumn = ({ team, sum, side, game }) => (
  <div className={`cand-team ${side}`}>
    <span className="cand-sum">{sum}</span>
    <ul>
      {[...team]
        .sort((a, b) => b.rating - a.rating)
        .map((p) => (
          <li key={p.id} title={tierName(game, p)}>
            <i style={{ background: getTier(game, p.tier).color }} />
            {p.name}
          </li>
        ))}
    </ul>
  </div>
);

const CandidateModal = ({ result, onSelect, onClose }) => {
  const game = useGameKey();
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
              <TeamColumn team={o.teamA} sum={o.sumA} side="blue" game={game} />
              <span className="cand-vs">VS</span>
              <TeamColumn team={o.teamB} sum={o.sumB} side="red" game={game} />
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
};

export default CandidateModal;
