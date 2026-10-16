import React, { useEffect, useState } from 'react';
import { riotGet } from '../../server/riot';
import { TFT_TYPES, tftName, errorText } from '../../rules/riot';
import { timeAgo } from '../../lib/timeAgo';

/* TFT 최근 매치. 롤과 같이 한 판씩 받는다.
   유닛·특성 이름은 API가 영어 키(TFT13_Jinx)로 준다 - 앞머리만 떼서 보여준다 */

const TftRow = ({ m, me, onSearch }) => {
  const [open, setOpen] = useState(false);
  const p = m.players.find((x) => x.puuid === me);
  if (!p) return null;
  const tone = p.placement === 1 ? 'is-first' : p.placement <= 4 ? 'is-top' : 'is-bottom';

  return (
    <li className={`riot-match riot-tft ${tone}`}>
      <button type="button" className="riot-tft-row" onClick={() => setOpen((v) => !v)}>
        <span className="riot-tft-place">
          <strong>{p.placement}</strong>
          <em>등</em>
        </span>
        <span className="riot-match-result">
          <em>{TFT_TYPES[m.type] || m.type || 'TFT'}</em>
          <em>
            {m.at ? timeAgo(m.at) : ''} · Lv.{p.level}
          </em>
        </span>
        <span className="riot-tags">
          {p.traits.map((t) => (
            <span key={t.name} className={`riot-tag tft-style-${t.style}`}>
              {tftName(t.name)} {t.units}
            </span>
          ))}
        </span>
        <span className="riot-tft-units">
          {p.units.map((u, i) => (
            <span key={i} className="riot-tft-unit">
              {tftName(u.id)}
              <em>{'★'.repeat(u.star || 1)}</em>
            </span>
          ))}
        </span>
      </button>
      {open && (
        <ol className="riot-tft-all">
          {m.players.map((x) => (
            <li key={x.puuid} className={x.puuid === me ? 'is-me' : ''}>
              <b>{x.placement}</b>
              <button
                type="button"
                className="riot-link"
                onClick={() => x.name && onSearch(`${x.name}#${x.tag}`)}
              >
                {x.name || '?'}
              </button>
              <span className="riot-muted">
                {x.traits
                  .slice(0, 2)
                  .map((t) => tftName(t.name))
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
};

const TftList = ({ ids, me, onSearch }) => {
  const [matches, setMatches] = useState({});

  useEffect(() => {
    let alive = true;
    ids.forEach((id) =>
      riotGet({ fn: 'tftMatch', id }).then((r) => alive && setMatches((prev) => ({ ...prev, [id]: r })))
    );
    return () => {
      alive = false;
    };
  }, [ids]);

  const places = ids
    .map((id) => matches[id]?.data?.players.find((x) => x.puuid === me)?.placement)
    .filter(Boolean);

  return (
    <div className="riot-matches">
      {places.length > 0 && (
        <div className="riot-summary">
          <strong>
            최근 {places.length}판 평균 {(places.reduce((a, b) => a + b, 0) / places.length).toFixed(1)}등
          </strong>
          <span>
            순방(4등 안) {places.filter((x) => x <= 4).length}번 · 1등 {places.filter((x) => x === 1).length}번
          </span>
        </div>
      )}
      <ul className="riot-match-list">
        {ids.map((id) => {
          const r = matches[id];
          if (!r) return <li key={id} className="riot-match is-loading" />;
          if (r.error !== undefined) {
            return (
              <li key={id} className="riot-match is-error">
                <span className="riot-muted">{errorText(r.error)}</span>
              </li>
            );
          }
          return <TftRow key={id} m={r.data} me={me} onSearch={onSearch} />;
        })}
      </ul>
    </div>
  );
};

export default TftList;
