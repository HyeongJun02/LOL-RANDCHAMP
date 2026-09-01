import React from 'react';
import { FaDice, FaRedo } from 'react-icons/fa';
import { championIcon, championPortrait } from '../../services/api';
import { findRole } from './roles';

const ResultPanel = ({ champion, rolling, version, onRoll, poolSize }) => {
  const shown = rolling || champion;

  return (
    <aside className="result-panel">
      <div className={`result-stage ${rolling ? 'is-rolling' : ''}`}>
        {shown ? (
          <img
            key={rolling ? shown.id : `pick-${shown.id}`}
            src={rolling ? championIcon(version, shown.id) : championPortrait(shown.id)}
            alt={shown.name}
            className="result-img"
          />
        ) : (
          <div className="result-empty">
            <FaDice />
            <p>버튼을 눌러 챔피언을 뽑아보세요</p>
          </div>
        )}

        {champion && !rolling && (
          <div className="result-caption">
            <h2>{champion.name}</h2>
            <p className="result-title">{champion.title}</p>
            <div className="result-roles">
              {champion.tags.map((tag) => {
                const role = findRole(tag);
                return role ? (
                  <span key={tag} className="result-role">
                    <img src={role.icon} alt="" />
                    {role.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>

      <button className="roll-btn" onClick={onRoll} disabled={!!rolling}>
        {champion && !rolling ? <FaRedo /> : <FaDice className="roll-dice" />}
        {rolling ? '뽑는 중...' : champion ? '다시 뽑기' : '랜덤 챔피언 뽑기'}
        <span className="roll-pool">{poolSize}명 중</span>
      </button>

      {champion && !rolling && (
        <a
          className="opgg-btn"
          href={`https://www.op.gg/champions/${champion.id.toLowerCase()}/build`}
          target="_blank"
          rel="noreferrer"
        >
          <img src="/site_icon/opgg_icon.png" alt="" className="opgg-icon" />
          OP.GG 공략 보기
        </a>
      )}
    </aside>
  );
};

export default ResultPanel;
