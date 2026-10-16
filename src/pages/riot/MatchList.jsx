import React, { useEffect, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { riotGet, champIconUrl, itemIconUrl } from '../../server/riot';
import { queueName, clock, kdaRatio, positionName, monsterName, errorText } from '../../rules/riot';
import { timeAgo } from '../../lib/timeAgo';
import GoldChart from './GoldChart';

/* 롤 최근 매치. 한 판씩 따로 받는다 - 끝난 판은 안 바뀌어서 서버가 하루
   캐시하고, 화면도 한 번 받은 판은 다시 안 부른다 (server/riot.js) */

const Items = ({ items, version, small }) => (
  <span className={`riot-items ${small ? 'is-small' : ''}`}>
    {items.map((it, i) => {
      const url = itemIconUrl(version, it);
      return url ? <img key={i} src={url} alt="" loading="lazy" /> : <i key={i} />;
    })}
  </span>
);

const Champ = ({ champs, name, small }) => {
  const c = champs?.byId.get(name);
  const url = champIconUrl(champs?.version, name);
  return (
    <span className={`riot-champ-icon ${small ? 'is-small' : ''}`} title={c?.name || name}>
      {url && <img src={url} alt="" loading="lazy" />}
    </span>
  );
};

/* 펼치면 두 팀 표 + 타임라인(첫 킬 · 오브젝트 · 골드 차이) */
const MatchDetail = ({ m, me, champs, onSearch }) => {
  const [tl, setTl] = useState(null);
  useEffect(() => {
    let alive = true;
    riotGet({ fn: 'timeline', id: m.id }).then((r) => alive && setTl(r));
    return () => {
      alive = false;
    };
  }, [m.id]);

  const byPuuid = new Map(m.players.map((p) => [p.puuid, p]));
  const myTeam = byPuuid.get(me)?.team;

  return (
    <div className="riot-detail">
      {[100, 200].map((team) => {
        const t = m.teams.find((x) => x.id === team) || {};
        return (
          <div key={team} className={`riot-team ${team === 100 ? 'is-blue' : 'is-red'}`}>
            <div className="riot-team-head">
              <strong>
                {team === 100 ? '블루팀' : '레드팀'} {t.win ? '승리' : '패배'}
                {team === myTeam && <em> · 내 팀</em>}
              </strong>
              <span>
                킬 {t.kills} · 용 {t.dragon} · 바론 {t.baron} · 타워 {t.tower}
              </span>
            </div>
            <ul>
              {m.players
                .filter((p) => p.team === team)
                .map((p) => (
                  <li key={p.puuid} className={p.puuid === me ? 'is-me' : ''}>
                    <Champ champs={champs} name={p.champ} small />
                    <button
                      type="button"
                      className="riot-link"
                      onClick={() => p.name && onSearch(`${p.name}#${p.tag}`)}
                    >
                      {p.name || '?'}
                    </button>
                    <span className="riot-detail-kda">
                      {p.k}/{p.d}/{p.a}
                    </span>
                    <span className="riot-detail-num">{p.dmg.toLocaleString()}</span>
                    <span className="riot-detail-num">{p.cs} CS</span>
                    <Items items={p.items} version={champs?.version} small />
                  </li>
                ))}
            </ul>
          </div>
        );
      })}

      <div className="riot-timeline">
        {!tl ? (
          <p className="riot-muted">타임라인 불러오는 중…</p>
        ) : tl.error !== undefined ? (
          <p className="riot-muted">타임라인: {errorText(tl.error)}</p>
        ) : (
          <>
            <div className="riot-tags">
              {tl.data.firstKill && (
                <span className="riot-tag is-fb">
                  첫 킬 {clock(tl.data.firstKill.t / 1000)} ·{' '}
                  {byPuuid.get(tl.data.firstKill.killer)?.name || '미니언 · 포탑'}
                </span>
              )}
              {tl.data.objectives.map((o, i) => (
                <span key={i} className={`riot-tag ${o.team === 100 ? 'is-blue' : 'is-red'}`}>
                  {clock(o.t / 1000)} {monsterName(o.type, o.sub)}
                </span>
              ))}
            </div>
            <GoldChart diff={tl.data.goldDiff} />
          </>
        )}
      </div>
    </div>
  );
};

const MatchRow = ({ m, me, champs, onSearch }) => {
  const [open, setOpen] = useState(false);
  const p = m.players.find((x) => x.puuid === me);
  if (!p) return null;
  const minutes = m.duration / 60 || 1;
  // 3분 안에 끝난 판은 다시하기(리메이크)
  const remake = m.duration < 300;
  const result = remake ? 'is-remake' : p.win ? 'is-win' : 'is-lose';

  return (
    <li className={`riot-match ${result}`}>
      <button type="button" className="riot-match-row" onClick={() => setOpen((v) => !v)}>
        <span className="riot-match-result">
          <strong>{remake ? '다시하기' : p.win ? '승리' : '패배'}</strong>
          <em>{queueName(m.queue, m.mode)}</em>
          <em>
            {m.end ? timeAgo(m.end) : ''} · {clock(m.duration)}
          </em>
        </span>
        <Champ champs={champs} name={p.champ} />
        <span className="riot-match-kda">
          <strong>
            {p.k} / <i>{p.d}</i> / {p.a}
          </strong>
          <em>
            {kdaRatio(p.k, p.d, p.a)} KDA
            {positionName(p.pos) && ` · ${positionName(p.pos)}`}
          </em>
        </span>
        <span className="riot-match-stat">
          <em>
            CS {p.cs} ({(p.cs / minutes).toFixed(1)})
          </em>
          <em>딜 {p.dmg.toLocaleString()}</em>
          {p.multi >= 3 && <b>{['', '', '', '트리플킬', '쿼드라킬', '펜타킬'][p.multi]}</b>}
        </span>
        <Items items={p.items} version={champs?.version} />
        <FaChevronDown className={`riot-chev ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      {open && <MatchDetail m={m} me={me} champs={champs} onSearch={onSearch} />}
    </li>
  );
};

const MatchList = ({ ids, me, champs, onSearch }) => {
  const [matches, setMatches] = useState({});

  useEffect(() => {
    let alive = true;
    ids.forEach((id) =>
      riotGet({ fn: 'match', id }).then((r) => alive && setMatches((prev) => ({ ...prev, [id]: r })))
    );
    return () => {
      alive = false;
    };
  }, [ids]);

  const done = ids.map((id) => matches[id]?.data).filter(Boolean);
  const mine = done
    .map((m) => ({ m, p: m.players.find((x) => x.puuid === me) }))
    .filter((x) => x.p && x.m.duration >= 300);
  const wins = mine.filter((x) => x.p.win).length;
  const sum = (f) => mine.reduce((s, x) => s + x.p[f], 0);

  return (
    <div className="riot-matches">
      {mine.length > 0 && (
        <div className="riot-summary">
          <strong>
            최근 {mine.length}판 {wins}승 {mine.length - wins}패
          </strong>
          <span>
            승률 {Math.round((wins / mine.length) * 100)}% · 평균{' '}
            {(sum('k') / mine.length).toFixed(1)} / {(sum('d') / mine.length).toFixed(1)} /{' '}
            {(sum('a') / mine.length).toFixed(1)} · {kdaRatio(sum('k'), sum('d'), sum('a'))} KDA
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
          return <MatchRow key={id} m={r.data} me={me} champs={champs} onSearch={onSearch} />;
        })}
      </ul>
    </div>
  );
};

export default MatchList;
